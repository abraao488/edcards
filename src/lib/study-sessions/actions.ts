"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ensureUserExists } from "@/lib/auth/sync";
import { requireActiveSubscriptionForAction } from "@/lib/subscription/guard";
import { getOrCreateActiveProfile } from "@/lib/profile/helpers";
import {
  resolveManualSchedule,
  type ManualScheduleType,
} from "@/lib/srs-review-utils";

/**
 * O `ProgressCard.difficultyStage` é uma String livre no schema — só o que
 * pertence ao enum DifficultyLevel pode virar `ReviewCycle.classification`.
 */
function toDifficultyStage(value: string | null | undefined) {
  return value === "EASY" || value === "HARD" ? value : "MEDIUM";
}

/**
 * `revalidatePath` fora de um request (ex.: harness de testes) lança. A
 * operação de banco já foi concluída — a invalidação de cache nunca pode
 * transformar um agendamento bem-sucedido em erro para o usuário.
 */
function safeRevalidate(paths: string[]) {
  for (const path of paths) {
    try {
      revalidatePath(path);
    } catch {
      // ambiente sem request context — ignora
    }
  }
}

export async function saveStudySession(
  subjectId: string | null,
  topicId: string | null,
  minutes: number,
  options?: { name?: string | null; startedAt?: Date | null; endedAt?: Date | null }
) {
  await requireActiveSubscriptionForAction();
  const user = await ensureUserExists();

  if (minutes <= 0) {
    throw new Error("Duration must be positive");
  }

  const now = new Date();
  const endedAt = options?.endedAt ?? now;
  const startedAt =
    options?.startedAt ?? new Date(endedAt.getTime() - minutes * 60 * 1000);

  const session = await prisma.studySession.create({
    data: {
      userId: user.id,
      name: options?.name?.trim() ? options.name.trim() : null,
      subjectId,
      topicId,
      durationMinutes: minutes,
      startedAt,
      endedAt,
    },
  });

  revalidatePath("/gerenciador");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/flashcards");

  return session;
}

export async function getStudySessionsHistory() {
  await requireActiveSubscriptionForAction();
  const user = await ensureUserExists();

  const sessions = await prisma.studySession.findMany({
    where: { userId: user.id },
    include: { subject: true, topic: true },
    orderBy: { createdAt: "desc" },
  });

  return sessions;
}

export async function updateQuizModePreference(value: boolean) {
  await requireActiveSubscriptionForAction();
  const user = await ensureUserExists();

  await prisma.userSettings.upsert({
    where: { userId: user.id },
    create: { userId: user.id, preferQuizMode: value },
    update: { preferQuizMode: value },
  });

  revalidatePath("/flashcards");
  revalidatePath("/dashboard/flashcards");
  revalidatePath("/gerenciador");

  return { success: true };
}

export async function getStudyTimeStats() {
  // A identidade NUNCA vem do cliente: deriva sempre da sessão autenticada.
  // Antes aceitava um userId arbitrário, o que permitia ler o histórico de
  // estudo de qualquer usuário (IDOR de leitura).
  await requireActiveSubscriptionForAction();
  const user = await ensureUserExists();

  const studySessions = await prisma.studySession.findMany({
    where: { userId: user.id },
    include: { subject: true, topic: true },
    orderBy: { createdAt: "desc" },
  });

  // Group by subject
  const subjectStats = new Map<
    string,
    { id: string; name: string; totalMinutes: number; topics: Map<string, { id: string; name: string; totalMinutes: number }> }
  >();

  for (const session of studySessions) {
    const subjectId = session.subjectId || "uncategorized";
    const subjectName = session.subject?.name || "Sem Matéria";
    const topicId = session.topicId || "uncategorized";
    const topicName = session.topic?.name || "Sem Assunto";

    if (!subjectStats.has(subjectId)) {
      subjectStats.set(subjectId, {
        id: subjectId,
        name: subjectName,
        totalMinutes: 0,
        topics: new Map(),
      });
    }

    const subject = subjectStats.get(subjectId)!;
    subject.totalMinutes += session.durationMinutes;

    if (!subject.topics.has(topicId)) {
      subject.topics.set(topicId, {
        id: topicId,
        name: topicName,
        totalMinutes: 0,
      });
    }

    const topic = subject.topics.get(topicId)!;
    topic.totalMinutes += session.durationMinutes;
  }

  // Convert maps to arrays for easier use in components
  return Array.from(subjectStats.values()).map((subject) => ({
    ...subject,
    topics: Array.from(subject.topics.values()),
  }));
}

/**
 * Agenda o cronograma de revisões de TODOS os cards de um tópico.
 *
 * O agendamento manual é persistido no mesmo formato do ciclo do SRS
 * (ReviewCycle + ScheduledReview), porque é isso que a fila e o calendário
 * leem — antes, só o `ProgressCard.nextReviewDate` era escrito e os dias 7/15
 * (ou +2/+4/+6/+8) simplesmente não existiam em lugar nenhum.
 *
 * Diferença para o ciclo do SRS: aqui NÃO há classificação (nada de IA). O
 * ciclo nasce com `initialCycleEvaluationCompleted = false` e é ADOTADO
 * depois pela classificação (ver `classifyAndCreateCycle` em lib/srs.ts),
 * que preserva as datas escolhidas pelo usuário.
 */
export async function scheduleTopicReviews(
  topicId: string,
  scheduleType: ManualScheduleType
) {
  await requireActiveSubscriptionForAction();
  const user = await ensureUserExists();
  const activeProfile = await getOrCreateActiveProfile(user.id, user.email || "");

  // Todos os flashcards do tópico que pertencem a este usuário.
  const flashcards = await prisma.flashcard.findMany({
    where: {
      topicId,
      deck: { userId: user.id },
    },
    select: { id: true },
  });

  const baseDate = new Date();
  const schedule = resolveManualSchedule(scheduleType, baseDate);

  if (flashcards.length === 0 || schedule.length === 0) {
    return { success: true, created: 0, skipped: 0, failed: 0 };
  }

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const card of flashcards) {
    try {
      const scheduled = await prisma.$transaction(async (tx) => {
        // Card já com ciclo ATIVO (SRS em andamento ou agendamento anterior):
        // não cria outro ciclo — o cronograma existente continua valendo e o
        // progresso (currentReview / revisões feitas) não é destruído.
        const activeCycle = await tx.reviewCycle.findFirst({
          where: { flashcardId: card.id, status: "ACTIVE" },
          select: { id: true },
        });
        if (activeCycle) return false;

        const progressCard = await tx.progressCard.upsert({
          where: { flashcardId: card.id },
          create: {
            profileId: activeProfile.id,
            flashcardId: card.id,
            nextReviewDate: schedule[0].scheduleDate,
            currentCycleDay: 1,
            difficultyStage: "MEDIUM",
            isCycleEnded: false,
          },
          update: {
            // NÃO toca em firstReviewAt: o card continua no mesmo ponto do
            // fluxo de revisão (1ª resolução / classificação / ciclo).
            nextReviewDate: schedule[0].scheduleDate,
            currentCycleDay: 1,
            isCycleEnded: false,
          },
        });

        const cycleId = crypto.randomUUID();

        await tx.reviewCycle.create({
          data: {
            id: cycleId,
            flashcardId: card.id,
            progressCardId: progressCard.id,
            profileId: progressCard.profileId,
            baseDate,
            classification: toDifficultyStage(progressCard.difficultyStage),
            status: "ACTIVE",
            totalReviews: schedule.length,
            currentReview: 1,
            // Agendamento manual não é classificação: o card ainda passa pela
            // etapa de avaliação, que vai adotar este ciclo.
            initialCycleEvaluationCompleted: false,
          },
        });

        await tx.scheduledReview.createMany({
          data: schedule.map((s, index) => ({
            cycleId,
            flashcardId: card.id,
            order: index + 1,
            scheduleDate: s.scheduleDate,
            isFinal: s.isFinal,
          })),
        });

        await tx.progressCard.update({
          where: { id: progressCard.id },
          data: {
            currentCycleDay: 1,
            nextReviewDate: schedule[0].scheduleDate,
            isCycleEnded: false,
          },
        });

        await tx.flashcard.update({
          where: { id: card.id },
          data: {
            nextReview: schedule[0].scheduleDate,
            currentCycleDay: 1,
            cycleCompleted: false,
          },
        });

        return true;
      });

      if (scheduled) created++;
      else skipped++;
    } catch (err) {
      failed++;
      console.error(
        `Falha ao agendar revisões do flashcard ${card.id}:`,
        err
      );
    }
  }

  safeRevalidate([
    "/flashcards",
    "/dashboard/flashcards",
    "/dashboard",
    "/gerenciador",
    "/materias",
  ]);

  return { success: failed === 0, created, skipped, failed };
}

export async function deleteStudySession(sessionId: string) {
  await requireActiveSubscriptionForAction();
  const user = await ensureUserExists();

  const existing = await prisma.studySession.findFirst({
    where: { id: sessionId, userId: user.id },
    select: { id: true },
  });

  if (!existing) {
    throw new Error("Sessão não encontrada ou sem permissão para excluir.");
  }

  await prisma.studySession.delete({
    where: { id: sessionId },
  });

  revalidatePath("/gerenciador");
}


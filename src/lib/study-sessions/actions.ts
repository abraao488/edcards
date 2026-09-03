"use server";

import { prisma } from "@/lib/prisma";
import { ensureUserExists } from "@/lib/auth/sync";
import { getOrCreateActiveProfile } from "@/lib/profile/helpers";

export async function saveStudySession(
  subjectId: string | null,
  topicId: string | null,
  minutes: number,
  options?: { name?: string | null; startedAt?: Date | null; endedAt?: Date | null }
) {
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

  return session;
}

export async function getStudySessionsHistory() {
  const user = await ensureUserExists();

  const sessions = await prisma.studySession.findMany({
    where: { userId: user.id },
    include: { subject: true, topic: true },
    orderBy: { createdAt: "desc" },
  });

  return sessions;
}

export async function updateQuizModePreference(value: boolean) {
  const user = await ensureUserExists();

  await prisma.userSettings.upsert({
    where: { userId: user.id },
    create: { userId: user.id, preferQuizMode: value },
    update: { preferQuizMode: value },
  });

  return { success: true };
}

export async function getStudyTimeStats(userId: string) {
  const studySessions = await prisma.studySession.findMany({
    where: { userId },
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

export async function scheduleTopicReviews(
  topicId: string,
  scheduleType: "standard" | "intensive" | "custom"
) {
  const user = await ensureUserExists();
  const activeProfile = await getOrCreateActiveProfile(user.id, user.email || "");

  // Get all flashcards for the topic belonging to this user
  const flashcards = await prisma.flashcard.findMany({
    where: {
      topicId,
      deck: { userId: user.id },
    },
  });

  const now = new Date();
  let reviewDays: number[];

  switch (scheduleType) {
    case "standard":
      reviewDays = [1, 7, 15];
      break;
    case "intensive":
      reviewDays = [2, 2, 2, 2];
      break;
    case "custom":
    default:
      reviewDays = [1, 7, 15];
      break;
  }

  // For each flashcard, update or create ProgressCard
  for (const card of flashcards) {
    const nextReview = new Date(now);
    nextReview.setDate(now.getDate() + reviewDays[0]);

    await prisma.progressCard.upsert({
      where: { flashcardId: card.id },
      create: {
        profileId: activeProfile.id,
        flashcardId: card.id,
        nextReviewDate: nextReview,
        currentCycleDay: 0,
        difficultyStage: "MEDIUM",
        isCycleEnded: false,
      },
      update: {
        nextReviewDate: nextReview,
        currentCycleDay: 0,
      },
    });
  }

  return { success: true };
}


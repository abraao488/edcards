"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { ensureUserExists } from "@/lib/auth/sync"
import { requireActiveSubscriptionForAction } from "@/lib/subscription/guard"
import {
  addDays,
  buildStudyPlan,
  classifyScheduleItems,
  startOfDay,
  toDateKey,
  type ScheduleItemKind,
  type SchedulePhase,
} from "@/lib/schedule/plan"
import type { ScheduleItem, Subject, Topic, StudySchedule } from "@prisma/client"

type ScheduleItemWithRelations = ScheduleItem & {
  subject: Subject | null
  topic: Topic | null
  /** Natureza do item: estudo de assunto novo ou revisão. Derivado na leitura. */
  kind: ScheduleItemKind
  /** Fase do plano: estudo, revisão intermediária ou revisão final. */
  phase: SchedulePhase
}

export type ScheduleWithDetails = (StudySchedule & {
  items: ScheduleItemWithRelations[]
  groupedByDay: Record<string, ScheduleItemWithRelations[]>
  scheduleId: string
  totalItems: number
}) | null

/**
 * `revalidatePath` fora de um request (ex.: harness de testes) lança. A
 * operação de banco já foi concluída — a invalidação de cache nunca pode
 * transformar um cronograma bem-sucedido em erro para o usuário.
 */
function safeRevalidate(paths: string[]) {
  for (const path of paths) {
    try {
      revalidatePath(path)
    } catch {
      // ambiente sem request context — ignora
    }
  }
}

/**
 * Gera o cronograma reverso ("Edital Fechado").
 *
 * A janela vai de hoje até a VÉSPERA da prova e é dividida em três fases
 * (ver `src/lib/schedule/plan.ts`): estudo, revisão intermediária e revisão
 * final. Nenhum dia do plano fica vazio e todo assunto é revisado na fase
 * final.
 *
 * @param examDate   data da prova
 * @param reviewDays dias de revisão final (imediatamente antes da prova)
 */
export async function generateReverseSchedule(
  examDate: Date,
  reviewDays: number
) {
  await requireActiveSubscriptionForAction()
  const user = await ensureUserExists()

  if (!Number.isInteger(reviewDays) || reviewDays < 1) {
    throw new Error("Informe ao menos 1 dia de revisão final!")
  }
  if (!(examDate instanceof Date) || Number.isNaN(examDate.getTime())) {
    throw new Error("Data da prova inválida!")
  }

  const today = startOfDay(new Date())
  const examDateObj = startOfDay(examDate)

  const daysBetween = Math.ceil(
    (examDateObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  )

  if (daysBetween <= reviewDays) {
    throw new Error(
      "A data limite é muito próxima! Aumente a data ou diminua os dias de revisão final."
    )
  }

  // Janela de ESTUDO. A janela de REVISÃO FINAL é o que sobra até a prova:
  // [startDate + totalDays, examDate).
  const studyDays = daysBetween - reviewDays

  const allTopics = await prisma.topic.findMany({
    where: { subject: { userId: user.id } },
    include: { subject: true },
  })

  if (allTopics.length === 0) {
    throw new Error("Nenhum assunto cadastrado!")
  }

  const existingSchedule = await prisma.studySchedule.findFirst({
    where: { userId: user.id },
  })
  if (existingSchedule) {
    await prisma.scheduleItem.deleteMany({
      where: { scheduleId: existingSchedule.id },
    })
    await prisma.studySchedule.delete({
      where: { id: existingSchedule.id },
    })
  }

  const schedule = await prisma.studySchedule.create({
    data: {
      userId: user.id,
      examDate: examDateObj,
      // `totalDays` = tamanho da janela de ESTUDO. A revisão final é derivada
      // dela: começa em `startDate + totalDays` e vai até a véspera da prova.
      totalDays: studyDays,
      startDate: today,
    },
  })

  const plan = buildStudyPlan(
    allTopics.map((topic) => ({ id: topic.id, subjectId: topic.subjectId })),
    studyDays,
    reviewDays
  )

  const items: {
    scheduleId: string
    subjectId?: string
    topicId?: string
    scheduledFor: Date
  }[] = plan.map((planItem) => ({
    scheduleId: schedule.id,
    subjectId: planItem.topic.subjectId,
    topicId: planItem.topic.id,
    scheduledFor: addDays(today, planItem.dayIndex),
  }))

  if (items.length > 0) {
    const CHUNK_SIZE = 1000
    for (let i = 0; i < items.length; i += CHUNK_SIZE) {
      await prisma.scheduleItem.createMany({
        data: items.slice(i, i + CHUNK_SIZE),
      })
    }
  }

  const scheduleDetails = await getScheduleWithDetails(schedule.id)
  if (!scheduleDetails) {
    throw new Error("Erro ao criar cronograma!")
  }

  safeRevalidate(["/edital", "/dashboard", "/gerenciador"])

  return {
    ...scheduleDetails,
    scheduleId: schedule.id,
    totalItems: items.length,
  }
}

export async function getScheduleWithDetails(
  scheduleId: string
): Promise<ScheduleWithDetails> {
  await requireActiveSubscriptionForAction()
  const user = await ensureUserExists()

  const schedule = await prisma.studySchedule.findFirst({
    where: { id: scheduleId, userId: user.id },
    include: {
      items: {
        orderBy: { scheduledFor: "asc" },
      },
    },
  })

  if (!schedule) {
    return null
  }

  // Fetch all subjects and topics to map them manually
  const [allSubjects, allTopics] = await Promise.all([
    prisma.subject.findMany({ where: { userId: user.id } }),
    prisma.topic.findMany({ where: { subject: { userId: user.id } } }),
  ])

  const subjectMap = new Map(allSubjects.map((s) => [s.id, s]))
  const topicMap = new Map(allTopics.map((t) => [t.id, t]))

  // Sem coluna `kind` no banco: o item é ESTUDO na primeira ocorrência do
  // assunto e REVISÃO nas seguintes. A janela de revisão final é derivada de
  // `startDate + totalDays` até a data da prova.
  const itemsWithRelations = classifyScheduleItems(
    schedule.items.map((item) => ({
      ...item,
      subject: item.subjectId ? subjectMap.get(item.subjectId) || null : null,
      topic: item.topicId ? topicMap.get(item.topicId) || null : null,
    })),
    { startDate: schedule.startDate, studyDays: schedule.totalDays }
  )

  const groupedByDay = itemsWithRelations.reduce((acc, item) => {
    const dateKey = toDateKey(item.scheduledFor)
    if (!acc[dateKey]) {
      acc[dateKey] = []
    }
    acc[dateKey].push(item)
    return acc
  }, {} as Record<string, ScheduleItemWithRelations[]>)

  return {
    ...schedule,
    items: itemsWithRelations,
    groupedByDay,
    scheduleId: schedule.id,
    totalItems: schedule.items.length,
  }
}

export async function getSchedules() {
  await requireActiveSubscriptionForAction()
  const user = await ensureUserExists()

  return prisma.studySchedule.findMany({
    where: { userId: user.id },
    include: {
      items: {
        orderBy: { scheduledFor: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  })
}

export async function markScheduleItemCompleted(itemId: string) {
  await requireActiveSubscriptionForAction()
  const user = await ensureUserExists()

  const item = await prisma.scheduleItem.findUnique({
    where: { id: itemId },
    include: { schedule: true },
  })
  if (!item || item.schedule.userId !== user.id) throw new Error("Item não encontrado")

  await prisma.scheduleItem.update({
    where: { id: itemId },
    data: { completed: true },
  })

  safeRevalidate(["/edital", "/dashboard"])
}

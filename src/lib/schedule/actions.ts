"use server"

import { prisma } from "@/lib/prisma"
import { ensureUserExists } from "@/lib/auth/sync"
import type { ScheduleItem, Subject, Topic, StudySchedule } from "@prisma/client"

type ScheduleItemWithRelations = ScheduleItem & {
  subject: Subject | null
  topic: Topic | null
}

export type ScheduleWithDetails = (StudySchedule & {
  items: ScheduleItemWithRelations[]
  groupedByDay: Record<string, ScheduleItemWithRelations[]>
  scheduleId: string
  totalItems: number
}) | null


export async function generateReverseSchedule(
  examDate: Date,
  reviewDays: number
) {
  const user = await ensureUserExists()

  // Get all topics for scheduling

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const examDateObj = new Date(examDate)
  examDateObj.setHours(0, 0, 0, 0)

  const daysBetween = Math.ceil(
    (examDateObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  )

  if (daysBetween <= reviewDays) {
    throw new Error(
      "A data limite é muito próxima! Aumente a data ou diminua os dias de revisão final."
    )
  }

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
      totalDays: studyDays,
      startDate: today,
    },
  })

  const topicsPerDay = Math.max(1, Math.ceil(allTopics.length / studyDays))
  const items: {
    scheduleId: string
    subjectId?: string
    topicId?: string
    scheduledFor: Date
  }[] = []

  for (let i = 0; i < studyDays; i++) {
    const scheduledDate = new Date(today)
    scheduledDate.setDate(today.getDate() + i)

    const startIndex = i * topicsPerDay
    const endIndex = startIndex + topicsPerDay
    const dayTopics = allTopics.slice(startIndex, endIndex)

    for (const topic of dayTopics) {
      items.push({
        scheduleId: schedule.id,
        subjectId: topic.subjectId,
        topicId: topic.id,
        scheduledFor: scheduledDate,
      })
    }
  }

  if (items.length > 0) {
    await prisma.scheduleItem.createMany({ data: items })
  }

  const scheduleDetails = await getScheduleWithDetails(schedule.id)
  if (!scheduleDetails) {
    throw new Error("Erro ao criar cronograma!")
  }
  return {
    ...scheduleDetails,
    scheduleId: schedule.id,
    totalItems: items.length,
  }
}

export async function getScheduleWithDetails(
  scheduleId: string
): Promise<ScheduleWithDetails> {
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

  const itemsWithRelations: ScheduleItemWithRelations[] = schedule.items.map(
    (item) => ({
      ...item,
      subject: item.subjectId ? subjectMap.get(item.subjectId) || null : null,
      topic: item.topicId ? topicMap.get(item.topicId) || null : null,
    })
  )

  const groupedByDay = itemsWithRelations.reduce((acc, item) => {
    const dateKey = item.scheduledFor.toISOString().split("T")[0]
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
}

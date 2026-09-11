"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { ensureUserExists } from "@/lib/auth/sync"

export interface TopicWithFlashcardCount {
  id: string
  name: string
  _count: {
    flashcards: number
  }
}

export interface SubjectWithTopicsAndCounts {
  id: string
  name: string
  topics: TopicWithFlashcardCount[]
}

export async function getSubjectsWithTopicCounts(
  userId: string
): Promise<SubjectWithTopicsAndCounts[]> {
  const subjects = await prisma.subject.findMany({
    where: { userId },
    include: {
      topics: {
        orderBy: { order: "asc" },
        include: {
          _count: {
            select: {
              flashcards: {
                where: {
                  deck: { userId },
                },
              },
            },
          },
        },
      },
    },
    orderBy: { order: "asc" },
  })

  return subjects.map((subject) => ({
    id: subject.id,
    name: subject.name,
    topics: subject.topics.map((topic) => ({
      id: topic.id,
      name: topic.name,
      _count: topic._count,
    })),
  }))
}

export async function getTopicFlashcardsForQuiz(userId: string, topicId: string) {
  const topic = await prisma.topic.findUnique({
    where: { id: topicId },
    include: { subject: true },
  })

  if (!topic) return null

  const flashcards = await prisma.flashcard.findMany({
    where: {
      topicId,
      deck: { userId },
    },
    include: {
      topic: {
        include: { subject: true },
      },
    },
    orderBy: { createdAt: "asc" },
  })

  return { topic, flashcards }
}

export async function updateSubjectOrder(items: { id: string; order: number }[]) {
  const user = await ensureUserExists()
  if (!Array.isArray(items) || items.length === 0) return { success: true }
  // valida que todos os ids pertencem ao user antes de aplicar
  const ids = items.map((i) => i.id)
  const owned = await prisma.subject.findMany({
    where: { id: { in: ids }, userId: user.id },
    select: { id: true },
  })
  const ownedIds = new Set(owned.map((o) => o.id))
  const validItems = items.filter((i) => ownedIds.has(i.id))
  if (validItems.length === 0) throw new Error("Nenhum item válido para reordenar")

  await prisma.$transaction(
    validItems.map(({ id, order }) =>
      prisma.subject.updateMany({ where: { id, userId: user.id }, data: { order } })
    )
  )
  revalidatePath("/materias")
  revalidatePath("/dashboard/flashcards")
  return { success: true }
}

// alias exigido pelo prompt: updateOrder(items: {id, order}[])
export async function updateOrder(items: { id: string; order: number }[]) {
  return updateSubjectOrder(items)
}

export async function updateTopicOrder(items: { id: string; order: number }[]) {
  const user = await ensureUserExists()
  if (!Array.isArray(items) || items.length === 0) return { success: true }
  const ids = items.map((i) => i.id)
  const owned = await prisma.topic.findMany({
    where: { id: { in: ids }, subject: { userId: user.id } },
    select: { id: true },
  })
  const ownedIds = new Set(owned.map((o) => o.id))
  const validItems = items.filter((i) => ownedIds.has(i.id))
  if (validItems.length === 0) throw new Error("Nenhum item válido para reordenar")

  await prisma.$transaction(
    validItems.map(({ id, order }) =>
      prisma.topic.updateMany({ where: { id, subject: { userId: user.id } }, data: { order } })
    )
  )
  revalidatePath("/materias")
  revalidatePath("/dashboard/flashcards")
  return { success: true }
}

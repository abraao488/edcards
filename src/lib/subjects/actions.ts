"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { ensureUserExists } from "@/lib/auth/sync"

export interface SubjectWithTopics {
  id: string
  name: string
  topics: { id: string; name: string }[]
}

function revalidateCadastroPaths() {
  revalidatePath("/cadastrar")
  revalidatePath("/materias")
  revalidatePath("/dashboard/flashcards")
  revalidatePath("/flashcards")
  revalidatePath("/dashboard")
  revalidatePath("/gerenciador")
}

export async function createSubject(name: string): Promise<{ success: true }> {
  const user = await ensureUserExists()

  const trimmed = name.trim()
  if (!trimmed) {
    throw new Error("Informe o nome da matéria.")
  }

  const maxOrder = await prisma.subject.aggregate({
    where: { userId: user.id },
    _max: { order: true },
  })
  const nextOrder = (maxOrder._max.order ?? -1) + 1

  await prisma.subject.create({
    data: { name: trimmed, userId: user.id, order: nextOrder },
  })

  revalidateCadastroPaths()
  return { success: true }
}

export async function createTopic(
  subjectId: string,
  name: string
): Promise<{ success: true }> {
  const user = await ensureUserExists()

  const trimmed = name.trim()
  if (!trimmed) {
    throw new Error("Informe o nome do assunto.")
  }
  if (!subjectId) {
    throw new Error("Selecione uma matéria.")
  }

  const subject = await prisma.subject.findFirst({
    where: { id: subjectId, userId: user.id },
  })
  if (!subject) {
    throw new Error("Matéria não encontrada.")
  }

  const maxOrder = await prisma.topic.aggregate({
    where: { subjectId },
    _max: { order: true },
  })
  const nextOrder = (maxOrder._max.order ?? -1) + 1

  await prisma.topic.create({
    data: { name: trimmed, subjectId, order: nextOrder },
  })

  revalidateCadastroPaths()
  return { success: true }
}

export async function deleteSubject(id: string) {
  const user = await ensureUserExists()

  const subject = await prisma.subject.findFirst({
    where: { id, userId: user.id },
  })
  if (!subject) throw new Error("Matéria não encontrada")

  // 1. Busca todos os topics da matéria
  const topics = await prisma.topic.findMany({
    where: { subjectId: id },
    select: { id: true },
  })
  const topicIds = topics.map((t) => t.id)

  // 2. Busca todos os flashcards vinculados a esses topics
  const flashcards = await prisma.flashcard.findMany({
    where: { topicId: { in: topicIds } },
    select: { id: true },
  })
  const flashcardIds = flashcards.map((f) => f.id)

  // 3. Deleta em transação respeitando todas as chaves estrangeiras:
  // ProgressCard -> FlashcardReview -> Flashcards -> StudySessions (update FKs) -> Topics -> Subject
  await prisma.$transaction(async (tx) => {
    if (flashcardIds.length > 0) {
      await tx.progressCard.deleteMany({
        where: { flashcardId: { in: flashcardIds } },
      })
      await tx.flashcardReview.deleteMany({
        where: { flashcardId: { in: flashcardIds } },
      })
      await tx.flashcard.deleteMany({
        where: { id: { in: flashcardIds } },
      })
    }

    if (topicIds.length > 0) {
      await tx.studySession.updateMany({
        where: { topicId: { in: topicIds } },
        data: { topicId: null },
      })
    }

    await tx.studySession.updateMany({
      where: { subjectId: id },
      data: { subjectId: null },
    })

    if (topicIds.length > 0) {
      await tx.topic.deleteMany({
        where: { id: { in: topicIds } },
      })
    }

    await tx.subject.delete({
      where: { id },
    })
  })

  revalidateCadastroPaths()
}

export async function deleteTopic(id: string) {
  const user = await ensureUserExists()

  const topic = await prisma.topic.findFirst({
    where: { id, subject: { userId: user.id } },
  })
  if (!topic) throw new Error("Assunto não encontrado")

  // 1. Busca todos os flashcards do topic
  const flashcards = await prisma.flashcard.findMany({
    where: { topicId: id },
    select: { id: true },
  })
  const flashcardIds = flashcards.map((f) => f.id)

  // 2. Deleta em transação respeitando chaves estrangeiras
  await prisma.$transaction(async (tx) => {
    if (flashcardIds.length > 0) {
      await tx.progressCard.deleteMany({
        where: { flashcardId: { in: flashcardIds } },
      })
      await tx.flashcardReview.deleteMany({
        where: { flashcardId: { in: flashcardIds } },
      })
      await tx.flashcard.deleteMany({
        where: { id: { in: flashcardIds } },
      })
    }

    await tx.studySession.updateMany({
      where: { topicId: id },
      data: { topicId: null },
    })

    await tx.topic.delete({
      where: { id },
    })
  })

  revalidateCadastroPaths()
}

export async function getSubjectsWithTopics(): Promise<SubjectWithTopics[]> {
  const user = await ensureUserExists()

  return prisma.subject.findMany({
    where: { userId: user.id },
    include: {
      topics: {
        orderBy: { order: "asc" },
      },
    },
    orderBy: { order: "asc" },
  })
}

export async function getFlashcardsForConsultation(subjectId: string) {
  const user = await ensureUserExists()

  const subject = await prisma.subject.findFirst({
    where: { id: subjectId, userId: user.id },
  })
  if (!subject) throw new Error("Matéria não encontrada")

  return prisma.flashcard.findMany({
    where: {
      topic: { subjectId },
      deck: { userId: user.id },
    },
    select: {
      id: true,
      front: true,
      back: true,
      currentCycleDay: true,
      cycleCompleted: true,
      difficultyLevel: true,
    },
  })
}

export async function updateSubjectOrder(items: { id: string; order: number }[]) {
  const user = await ensureUserExists()
  if (!Array.isArray(items) || items.length === 0) return { success: true }
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
  revalidateCadastroPaths()
  return { success: true }
}

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
  revalidateCadastroPaths()
  return { success: true }
}

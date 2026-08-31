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
  revalidatePath("/materias")
  revalidatePath("/dashboard/flashcards")
  revalidatePath("/flashcards")
}

export async function createSubject(name: string): Promise<{ success: true }> {
  await ensureUserExists()

  const trimmed = name.trim()
  if (!trimmed) {
    throw new Error("Informe o nome da matéria.")
  }

  await prisma.subject.create({
    data: { name: trimmed },
  })

  revalidateCadastroPaths()
  return { success: true }
}

export async function createTopic(
  subjectId: string,
  name: string
): Promise<{ success: true }> {
  await ensureUserExists()

  const trimmed = name.trim()
  if (!trimmed) {
    throw new Error("Informe o nome do assunto.")
  }
  if (!subjectId) {
    throw new Error("Selecione uma matéria.")
  }

  const subject = await prisma.subject.findUnique({
    where: { id: subjectId },
  })
  if (!subject) {
    throw new Error("Matéria não encontrada.")
  }

  await prisma.topic.create({
    data: { name: trimmed, subjectId },
  })

  revalidateCadastroPaths()
  return { success: true }
}

export async function deleteSubject(id: string) {
  await ensureUserExists()

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
  await ensureUserExists()

  const topic = await prisma.topic.findUnique({ where: { id } })
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
  await ensureUserExists()

  return prisma.subject.findMany({
    include: {
      topics: {
        orderBy: { name: "asc" },
      },
    },
    orderBy: { name: "asc" },
  })
}

export async function getFlashcardsForConsultation(subjectId: string) {
  const user = await ensureUserExists()

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

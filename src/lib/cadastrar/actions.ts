"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { ensureUserExists } from "@/lib/auth/sync"
import { getOrCreateActiveProfile } from "@/lib/profile/helpers"
import { sanitizeHtml, stripHtml } from "@/lib/sanitize"

export async function createFlashcardWithTopic(
  front: string,
  back: string,
  topicId: string,
  cardType: "BASIC" | "REVERSED" | "CLOZE" = "BASIC"
): Promise<{ success: true }> {
  const user = await ensureUserExists()

  const sanitizedFront = sanitizeHtml(front)
  const sanitizedBack = sanitizeHtml(back)
  const plainFront = stripHtml(sanitizedFront)
  const plainBack = stripHtml(sanitizedBack)

  const processedFront = sanitizedFront.trim()
  let processedBack = sanitizedBack.trim()

  if (!plainFront) {
    throw new Error("Pergunta é obrigatória.")
  }

  if (cardType === "CLOZE") {
    const clozeRegex = /\{\{c\d+::([^}]+)\}\}/g
    let match
    const extractedAnswers: string[] = []

    // Extrai de plainFront para não quebrar com tags HTML internas
    while ((match = clozeRegex.exec(plainFront)) !== null) {
      extractedAnswers.push(match[1])
    }

    if (extractedAnswers.length === 0) {
      throw new Error("Formato Cloze inválido. Use {{c1::palavra}} para marcar a palavra a ser ocultada.")
    }

    processedBack = extractedAnswers.join(", ")
  } else {
    if (!plainBack) {
      throw new Error("Resposta é obrigatória.")
    }
  }

  if (!topicId) {
    throw new Error("Selecione um assunto.")
  }

  const topic = await prisma.topic.findUnique({
    where: { id: topicId },
  })
  if (!topic) {
    throw new Error("Assunto não encontrado.")
  }

  let deck = await prisma.deck.findFirst({
    where: { userId: user.id },
  })

  if (!deck) {
    deck = await prisma.deck.create({
      data: {
        name: "Baralho Padrão",
        userId: user.id,
      },
    })
  }

  const activeProfile = await getOrCreateActiveProfile(user.id, user.email || "")

  await prisma.$transaction(async (tx) => {
    const maxOrder = await tx.flashcard.aggregate({
      where: { topicId },
      _max: { order: true },
    })
    const baseOrder = (maxOrder._max.order ?? -1) + 1

    if (cardType === "REVERSED") {
      const card1 = await tx.flashcard.create({
        data: {
          front: processedFront,
          back: processedBack,
          cardType: "BASIC",
          deckId: deck!.id,
          topicId,
          order: baseOrder,
          nextReview: new Date(),
          currentCycleDay: 0,
        },
      })
      await tx.progressCard.create({
        data: {
          profileId: activeProfile.id,
          flashcardId: card1.id,
          currentCycleDay: 0,
          nextReviewDate: new Date(),
          difficultyStage: "MEDIUM",
          isCycleEnded: false,
        },
      })

      const card2 = await tx.flashcard.create({
        data: {
          front: processedBack,
          back: processedFront,
          cardType: "BASIC",
          deckId: deck!.id,
          topicId,
          order: baseOrder + 1,
          nextReview: new Date(),
          currentCycleDay: 0,
        },
      })
      await tx.progressCard.create({
        data: {
          profileId: activeProfile.id,
          flashcardId: card2.id,
          currentCycleDay: 0,
          nextReviewDate: new Date(),
          difficultyStage: "MEDIUM",
          isCycleEnded: false,
        },
      })
    } else {
      const flashcard = await tx.flashcard.create({
        data: {
          front: processedFront,
          back: processedBack,
          cardType,
          deckId: deck!.id,
          topicId,
          order: baseOrder,
          nextReview: new Date(),
          currentCycleDay: 0,
        },
      })
      await tx.progressCard.create({
        data: {
          profileId: activeProfile.id,
          flashcardId: flashcard.id,
          currentCycleDay: 0,
          nextReviewDate: new Date(),
          difficultyStage: "MEDIUM",
          isCycleEnded: false,
        },
      })
    }
  })

  revalidatePath("/cadastrar")
  revalidatePath("/materias")
  revalidatePath("/flashcards")
  revalidatePath("/dashboard/flashcards")

  return { success: true }
}

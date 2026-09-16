"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { ensureUserExists } from "@/lib/auth/sync"
import { getOrCreateActiveProfile } from "@/lib/profile/helpers"
import { createFlashcardWithTopic } from "@/lib/cadastrar/actions"
import { sanitizeHtml, stripHtml } from "@/lib/sanitize"

export async function createCardWithSubject(
  front: string,
  back: string,
  topicId?: string,
  cardType: "BASIC" | "REVERSED" | "CLOZE" = "BASIC"
) {
  if (topicId) {
    await createFlashcardWithTopic(front, back, topicId, cardType)
    return
  }

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
      where: topicId ? { topicId } : { deckId: deck!.id },
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

  revalidatePath("/dashboard/flashcards")
  revalidatePath("/flashcards")
  revalidatePath("/materias")
  revalidatePath("/dashboard")
  revalidatePath("/cadastrar")
}

export async function createBulkFlashcards(
  cards: { front: string; back: string; topicId?: string; cardType?: "BASIC" | "REVERSED" | "CLOZE" }[]
) {
  for (const card of cards) {
    if (card.topicId) {
      await createFlashcardWithTopic(card.front, card.back, card.topicId, card.cardType || "BASIC")
    } else {
      await createCardWithSubject(card.front, card.back, card.topicId, card.cardType || "BASIC")
    }
  }

  revalidatePath("/dashboard")
  revalidatePath("/dashboard/flashcards")
  revalidatePath("/flashcards")
  revalidatePath("/materias")
  revalidatePath("/cadastrar")

  return { count: cards.length }
}

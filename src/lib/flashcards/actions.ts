"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { ensureUserExists } from "@/lib/auth/sync"
import { getOrCreateActiveProfile } from "@/lib/profile/helpers"


export async function createDeck(formData: FormData) {
  const user = await ensureUserExists()

  await prisma.deck.create({
    data: {
      name: formData.get("name") as string,
      description: formData.get("description") as string,
      userId: user.id,
    },
  })

  revalidatePath("/dashboard/flashcards")
}

export async function deleteDeck(id: string) {
  const user = await ensureUserExists()

  await prisma.deck.deleteMany({ where: { id, userId: user.id } })
  revalidatePath("/dashboard/flashcards")
}

export async function createFlashcard(deckId: string, formData: FormData) {
  const user = await ensureUserExists()
  const activeProfile = await getOrCreateActiveProfile(user.id, user.email || "")

  const topicId = (formData.get("topicId") as string) || undefined
  const cardType = (formData.get("cardType") as "BASIC" | "REVERSED" | "CLOZE") || "BASIC"
  
  const front = (formData.get("front") as string).trim()
  let back = (formData.get("back") as string).trim()

  if (!front) {
    throw new Error("Pergunta é obrigatória.")
  }

  if (cardType === "CLOZE") {
    const clozeRegex = /\{\{c\d+::([^}]+)\}\}/g
    let match
    const extractedAnswers: string[] = []

    while ((match = clozeRegex.exec(front)) !== null) {
      extractedAnswers.push(match[1])
    }

    if (extractedAnswers.length === 0) {
      throw new Error("Formato Cloze inválido. Use {{c1::palavra}} para marcar a palavra a ser ocultada.")
    }

    back = extractedAnswers.join(", ")
  } else {
    if (!back) {
      throw new Error("Resposta é obrigatória.")
    }
  }

  await prisma.$transaction(async (tx) => {
    if (cardType === "REVERSED") {
      const card1 = await tx.flashcard.create({
        data: {
          front,
          back,
          cardType: "BASIC",
          deckId,
          topicId,
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
          front: back,
          back: front,
          cardType: "BASIC",
          deckId,
          topicId,
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
          front,
          back,
          cardType,
          deckId,
          topicId,
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

  revalidatePath(`/dashboard/flashcards/${deckId}`)
  revalidatePath("/materias")
}

export async function deleteFlashcard(id: string, deckId: string) {
  const user = await ensureUserExists()

  await prisma.flashcard.deleteMany({ where: { id, deck: { userId: user.id } } })
  revalidatePath(`/dashboard/flashcards/${deckId}`)
}


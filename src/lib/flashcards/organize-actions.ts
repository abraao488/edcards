"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { ensureUserExists } from "@/lib/auth/sync"

export async function organizeOverdueCards() {
  const user = await ensureUserExists()

  // Get active profile
  const profile = await prisma.profile.findFirst({
    where: { userId: user.id, isActiveProfile: true },
  })

  if (!profile) {
    throw new Error("Nenhum perfil ativo encontrado")
  }

  // Get all overdue progress cards, sorted by difficulty (HARD first)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const overdueCards = await prisma.progressCard.findMany({
    where: {
      profileId: profile.id,
      nextReviewDate: { lt: today },
    },
    orderBy: [
      { difficultyStage: "desc" }, // HARD comes first
      { nextReviewDate: "asc" },
    ],
  })

  if (overdueCards.length === 0) {
    return { count: 0 }
  }

  // Redistribute the cards
  const cardsPerDay = 5
  const currentDate = new Date(today)

  for (let i = 0; i < overdueCards.length; i++) {
    const card = overdueCards[i]
    const dayOffset = Math.floor(i / cardsPerDay)

    const newReviewDate = new Date(currentDate)
    newReviewDate.setDate(currentDate.getDate() + dayOffset)

    await prisma.progressCard.update({
      where: { id: card.id },
      data: { nextReviewDate: newReviewDate },
    })
  }

  revalidatePath("/dashboard/flashcards")
  revalidatePath("/organizar")

  return { count: overdueCards.length }
}

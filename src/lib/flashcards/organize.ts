"use server"

import { prisma } from "@/lib/prisma"
import { ensureUserExists } from "@/lib/auth/sync"

export async function redistributeOverdueCards() {
  const user = await ensureUserExists()

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const overdueCards = await prisma.flashcard.findMany({
    where: {
      deck: { userId: user.id },
      nextReview: { lt: today },
    },
    include: {
      reviews: {
        orderBy: { date: "desc" },
        take: 5,
      },
    },
    take: 200,
  })

  const sorted = overdueCards.sort((a, b) => {
    const aHardCount = a.reviews.filter((r) => r.difficultyLevel === "HARD").length
    const bHardCount = b.reviews.filter((r) => r.difficultyLevel === "HARD").length
    return bHardCount - aHardCount
  })

  const CHUNK_SIZE = 50
  for (let i = 0; i < sorted.length; i += CHUNK_SIZE) {
    const chunk = sorted.slice(i, i + CHUNK_SIZE)
    const updates = chunk.map((card, idx) => {
      const daysFromNow = Math.floor((i + idx) / 10)
      const nextDate = new Date(today)
      nextDate.setDate(nextDate.getDate() + daysFromNow)

      return prisma.flashcard.update({
        where: { id: card.id },
        data: { nextReview: nextDate },
      })
    })
    await prisma.$transaction(updates)
  }

  return { redistributed: sorted.length }
}

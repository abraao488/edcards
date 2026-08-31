"use server"

import { prisma } from "@/lib/prisma"
import { ensureUserExists } from "@/lib/auth/sync"

async function getActiveProfileId(): Promise<string | null> {
  const user = await ensureUserExists()
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    include: { profiles: { orderBy: { createdAt: "asc" } } },
  })
  if (!dbUser || dbUser.profiles.length === 0) return null
  const active =
    dbUser.profiles.find((p) => p.id === dbUser.activeProfileId || p.isActiveProfile) ??
    dbUser.profiles[0]
  return active.id
}

export async function getUpcomingFlashcards() {
  const profileId = await getActiveProfileId()
  if (!profileId) return []

  const upcomingCards = await prisma.progressCard.findMany({
    where: { profileId },
    orderBy: { nextReviewDate: "asc" },
    take: 3,
    include: {
      flashcard: {
        include: {
          deck: true,
          topic: {
            include: {
              subject: true,
            },
          },
        },
      },
    },
  })

  return upcomingCards
}

// Contagem compacta da fila de hoje — reaproveita mesma base (activeProfile + progressCard)
// usada pelo Gerenciador. Retorna quantos cards ainda faltam com nextReviewDate vencido.
export async function getReviewQueueCount(): Promise<number> {
  const profileId = await getActiveProfileId()
  if (!profileId) return 0

  return prisma.progressCard.count({
    where: {
      profileId,
      nextReviewDate: { lte: new Date() },
    },
  })
}

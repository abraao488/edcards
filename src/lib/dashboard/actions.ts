"use server"

import { prisma } from "@/lib/prisma"
import { ensureUserExists } from "@/lib/auth/sync"

export async function getDashboardMetrics() {
  const user = await ensureUserExists()

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const [profile, cardsToday, overdueCards, streak, subjectsCount] =
    await Promise.all([
      prisma.profile.findFirst({ where: { userId: user.id } }),
      prisma.progressCard.count({
        where: {
          profile: { userId: user.id },
          nextReviewDate: { gte: today, lt: tomorrow },
        },
      }),
      prisma.progressCard.count({
        where: {
          profile: { userId: user.id },
          nextReviewDate: { lt: today },
        },
      }),
      calculateStreak(user.id),
      prisma.subject.count({
        where: { userId: user.id },
      }),
    ])

  return {
    concurrence: profile?.concurrenceName || null,
    avatarUrl: profile?.avatarUrl || null,
    name: profile?.name || user.email || "Usuário",
    email: user.email || "",
    cardsToday,
    overdueCards,
    streak,
    subjectsCount,
  }
}

async function calculateStreak(userId: string): Promise<number> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const settings = await prisma.userSettings.findUnique({
    where: { userId },
    select: { streakCount: true, lastStreakDate: true },
  })

  if (settings?.lastStreakDate) {
    const lastDate = new Date(settings.lastStreakDate)
    lastDate.setHours(0, 0, 0, 0)

    const diffDays = Math.floor(
      (today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
    )

    if (diffDays === 0) {
      return settings.streakCount
    }

    if (diffDays === 1) {
      const todayReviews = await prisma.flashcardReview.findFirst({
        where: {
          userId,
          date: { gte: today, lt: tomorrow },
        },
        select: { id: true },
      })

      if (todayReviews) {
        const updated = await prisma.userSettings.update({
          where: { userId },
          data: {
            streakCount: settings.streakCount + 1,
            lastStreakDate: today,
          },
        })
        return updated.streakCount
      }
    }
  }

  const rawReviews = await prisma.$queryRaw<{ day: Date }[]>`
    SELECT DISTINCT DATE(date) as day
    FROM "FlashcardReview"
    WHERE "userId" = ${userId}
    ORDER BY day DESC
    LIMIT 365
  `

  if (rawReviews.length === 0) return 0

  let streak = 0
  for (let i = 0; i < rawReviews.length; i++) {
    const reviewDay = new Date(rawReviews[i].day)
    reviewDay.setHours(0, 0, 0, 0)
    const expectedDate = new Date(today)
    expectedDate.setDate(expectedDate.getDate() - i)

    if (reviewDay.getTime() === expectedDate.getTime()) {
      streak++
    } else {
      break
    }
  }

  await prisma.userSettings.upsert({
    where: { userId },
    update: { streakCount: streak, lastStreakDate: today },
    create: { userId, streakCount: streak, lastStreakDate: today },
  })

  return streak
}

export async function getRevisionCalendar(days: number = 30) {
  const user = await ensureUserExists()

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const endDate = new Date(today)
  endDate.setDate(endDate.getDate() + days)

  const progressCards = await prisma.progressCard.findMany({
    where: {
      profile: { userId: user.id },
      nextReviewDate: { gte: today, lte: endDate },
    },
    select: {
      nextReviewDate: true,
      flashcard: {
        select: {
          front: true,
          deck: { select: { name: true } },
          topic: {
            select: {
              name: true,
              subject: { select: { name: true } },
            },
          },
        },
      },
    },
  })

  const calendar: Record<string, Array<{ front: string; deckName: string; subjectName?: string; topicName?: string }>> = {}
  progressCards.forEach((pc) => {
    const dateStr = pc.nextReviewDate.toISOString().split("T")[0]
    if (!calendar[dateStr]) {
      calendar[dateStr] = []
    }
    calendar[dateStr].push({
      front: pc.flashcard.front,
      deckName: pc.flashcard.deck.name,
      subjectName: pc.flashcard.topic?.subject?.name,
      topicName: pc.flashcard.topic?.name,
    })
  })

  return calendar
}

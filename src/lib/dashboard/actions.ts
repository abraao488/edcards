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
      const todayActivity = await prisma.flashcardReview.findFirst({
        where: {
          userId,
          date: { gte: today, lt: tomorrow },
        },
        select: { id: true },
      })
      // fallback: StudySession também conta como atividade se não houve review
      let hasToday = Boolean(todayActivity)
      if (!hasToday) {
        const todaySession = await prisma.studySession.findFirst({
          where: {
            userId,
            OR: [
              { startedAt: { gte: today, lt: tomorrow } },
              { createdAt: { gte: today, lt: tomorrow } },
            ],
          },
          select: { id: true },
        })
        hasToday = Boolean(todaySession)
      }

      if (hasToday) {
        const updated = await prisma.userSettings.update({
          where: { userId },
          data: {
            streakCount: settings.streakCount + 1,
            lastStreakDate: today,
          },
        })
        return updated.streakCount
      }
      // sem atividade hoje ainda: mantém streak anterior até o fim do dia (não zera)
      // cai no recompute abaixo que retornará streak baseado em ontem
    }
  }

  // Fallback recompute: considera FlashcardReview + StudySession (cobre Gerenciador manual)
  const rawReviews = await prisma.$queryRaw<{ day: Date }[]>`
    SELECT DISTINCT DATE(date) as day
    FROM "FlashcardReview"
    WHERE "userId" = ${userId}
    ORDER BY day DESC
    LIMIT 365
  `

  const rawSessions = await prisma.$queryRaw<{ day: Date }[]>`
    SELECT DISTINCT DATE(COALESCE("startedAt", "createdAt")) as day
    FROM "StudySession"
    WHERE "userId" = ${userId}
    ORDER BY day DESC
    LIMIT 365
  `

  // merge distinct days (ISO date string) e ordena DESC
  const dayKey = (d: Date) => {
    const nd = new Date(d)
    nd.setHours(0, 0, 0, 0)
    return nd.toISOString()
  }
  const merged = new Map<string, Date>()
  for (const r of rawReviews) {
    const nd = new Date(r.day)
    nd.setHours(0, 0, 0, 0)
    merged.set(dayKey(nd), nd)
  }
  for (const r of rawSessions) {
    if (!r.day) continue
    const nd = new Date(r.day)
    nd.setHours(0, 0, 0, 0)
    merged.set(dayKey(nd), nd)
  }
  const allDays = Array.from(merged.values()).sort(
    (a, b) => b.getTime() - a.getTime()
  )

  if (allDays.length === 0) {
    await prisma.userSettings.upsert({
      where: { userId },
      update: { streakCount: 0, lastStreakDate: null },
      create: { userId, streakCount: 0, lastStreakDate: null },
    })
    return 0
  }

  const diffFromToday = Math.floor(
    (today.getTime() - allDays[0].getTime()) / (1000 * 60 * 60 * 24)
  )
  if (diffFromToday > 1) {
    // último dia ativo foi há mais de 1 dia → streak quebrado
    await prisma.userSettings.upsert({
      where: { userId },
      update: { streakCount: 0, lastStreakDate: allDays[0] },
      create: { userId, streakCount: 0, lastStreakDate: allDays[0] },
    })
    return 0
  }

  let streak = 0
  for (let i = 0; i < allDays.length; i++) {
    const expected = new Date(allDays[0])
    expected.setDate(expected.getDate() - i)
    if (allDays[i].getTime() === expected.getTime()) {
      streak++
    } else {
      break
    }
  }

  const lastStreakDay = allDays[0]
  await prisma.userSettings.upsert({
    where: { userId },
    update: { streakCount: streak, lastStreakDate: lastStreakDay },
    create: { userId, streakCount: streak, lastStreakDate: lastStreakDay },
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
    const d = pc.nextReviewDate
    // Usa data local (America/Sao_Paulo no cliente) para alinhar com RevisionCalendarInline que monta chaves com getFullYear/getMonth/getDate local
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
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

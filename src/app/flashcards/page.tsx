import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { FlashcardsReviewView } from "@/components/flashcards-review-view"
import { getReviewQueueCount } from "@/lib/flashcards/upcoming-actions"
import { queueFilterWithoutCompletedOnly } from "@/lib/srs-review-utils"
import {
  getSubjectsWithTopicCounts,
  getTopicFlashcardsForQuiz,
} from "@/lib/materias/actions"

export const dynamic = "force-dynamic"

interface FlashcardsPageProps {
  searchParams: { topicId?: string; renewCardId?: string }
}

export default async function FlashcardsPage({
  searchParams,
}: FlashcardsPageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect("/login")
  }

  const [dbUser, settings, queueCount, subjects] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      include: {
        profiles: {
          orderBy: { createdAt: "asc" },
        },
      },
    }),
    prisma.userSettings.findUnique({
      where: { userId: user.id },
    }),
    getReviewQueueCount(),
    getSubjectsWithTopicCounts(user.id),
  ])

  if (!dbUser) {
    redirect("/login")
  }

  const topicId = searchParams.topicId
  const renewCardId = searchParams.renewCardId

  // Renovação de ciclo a partir de Matérias: abre o card (já finalizado) para
  // uma nova classificação que cria o próximo ciclo
  if (renewCardId) {
    const related = await prisma.progressCard.findFirst({
      where: {
        id: renewCardId,
        profile: { userId: dbUser.id },
      },
      include: {
        flashcard: {
          include: {
            topic: {
              include: { subject: true },
            },
          },
        },
        reviewCycles: {
          select: {
            id: true,
            classification: true,
            currentReview: true,
            totalReviews: true,
            baseDate: true,
            status: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
    })

    if (related) {
      const formattedCards = [formatQueueProgressCard(related)]
      return (
        <FlashcardsReviewView
          initialProgressCards={formattedCards}
          userId={dbUser.id}
          email={dbUser.email}
          pomodoroMin={settings?.pomodoroMin ?? 25}
          initialQueueCount={queueCount}
          subjects={subjects}
        />
      )
    }
  }

  // Revisão por assunto específico — sempre em modo real (isQuizMode=false, com SRS + IA)
  if (topicId) {
    const result = await getTopicFlashcardsForQuiz(dbUser.id, topicId)

    if (!result || result.flashcards.length === 0) {
      // Sem flashcards para o assunto: cai no comportamento padrão (fila)
      const formattedCards = await loadQueueCards(dbUser)
      if (!formattedCards) redirect("/login")

      return (
        <FlashcardsReviewView
          initialProgressCards={formattedCards}
          userId={dbUser.id}
          email={dbUser.email}
          pomodoroMin={settings?.pomodoroMin ?? 25}
          initialQueueCount={queueCount}
          subjects={subjects}
          initialTopicId={topicId}
        />
      )
    }

    const formattedCards = result.flashcards.map((fc) => ({
      id: fc.id,
      currentCycleDay: fc.currentCycleDay,
      firstReviewAt: null,
      hasChosenEvalMode: false,
      isCycleEnded: false,
      difficultyStage: "MEDIUM" as const,
      activeCycle: null,
      hasCompletedCycle: false,
      flashcard: {
        id: fc.id,
        front: fc.front,
        back: fc.back,
        cardType: (fc as unknown as { cardType?: string }).cardType ?? "BASIC",
        topic: fc.topic
          ? {
              id: fc.topic.id,
              name: fc.topic.name,
              subject: {
                id: fc.topic.subject.id,
                name: fc.topic.subject.name,
              },
            }
          : null,
      },
    }))

    return (
      <FlashcardsReviewView
        initialProgressCards={formattedCards}
        userId={dbUser.id}
        email={dbUser.email}
        pomodoroMin={settings?.pomodoroMin ?? 25}
        initialQueueCount={queueCount}
        subjects={subjects}
        initialTopicId={topicId}
      />
    )
  }

  // Comportamento padrão: fila de revisão do profile ativo
  const formattedCards = await loadQueueCards(dbUser)
  if (!formattedCards) redirect("/login")

  return (
    <FlashcardsReviewView
      initialProgressCards={formattedCards}
      userId={dbUser.id}
      email={dbUser.email}
      pomodoroMin={settings?.pomodoroMin ?? 25}
      initialQueueCount={queueCount}
      subjects={subjects}
    />
  )
}

async function loadQueueCards(dbUser: {
  id: string
  email: string
  activeProfileId: string | null
  profiles: {
    id: string
    name: string | null
    isActiveProfile: boolean
  }[]
}) {
  // Find active profile (matching activeProfileId or marked as isActiveProfile, or first profile)
  let activeProfile =
    dbUser.profiles.find((p) => p.id === dbUser.activeProfileId || p.isActiveProfile) ||
    dbUser.profiles[0]

  // Create a default profile if user has none
  if (!activeProfile) {
    activeProfile = await prisma.profile.create({
      data: {
        userId: dbUser.id,
        name: dbUser.email.split("@")[0] || "Usuário",
        isActiveProfile: true,
      },
    })
  }

  // Fetch only ProgressCard records where nextReviewDate <= current time
  // (excluindo cards cujo ciclo já foi finalizado — eles só voltam na renovação)
  const progressCards = await prisma.progressCard.findMany({
    where: {
      profileId: activeProfile.id,
      nextReviewDate: { lte: new Date() },
      ...queueFilterWithoutCompletedOnly(),
    },
    include: {
      flashcard: {
        include: {
          topic: {
            include: {
              subject: true,
            },
          },
        },
      },
      reviewCycles: {
        select: {
          id: true,
          classification: true,
          currentReview: true,
          totalReviews: true,
          baseDate: true,
          status: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { nextReviewDate: "asc" },
  })

  // Format progressCards to client components expected types
  return progressCards.map(formatQueueProgressCard)
}

function formatQueueProgressCard(pc: {
  id: string
  currentCycleDay: number
  firstReviewAt: Date | null
  isCycleEnded: boolean
  difficultyStage: string | null
  reviewCycles: {
    id: string
    classification: string
    currentReview: number
    totalReviews: number
    baseDate: Date
    status: string
  }[]
  flashcard: {
    id: string
    front: string
    back: string
    cardType?: string
    topic: {
      id: string
      name: string
      subject: { id: string; name: string }
    } | null
  }
}) {
  const activeCycle = pc.reviewCycles.find((c) => c.status === "ACTIVE") ?? null
  return {
    id: pc.id,
    currentCycleDay: pc.currentCycleDay,
    firstReviewAt: pc.firstReviewAt,
    hasChosenEvalMode: (pc as unknown as { hasChosenEvalMode?: boolean }).hasChosenEvalMode ?? false,
    isCycleEnded: pc.isCycleEnded,
    difficultyStage: (pc.difficultyStage as "EASY" | "MEDIUM" | "HARD") || "MEDIUM",
    activeCycle: activeCycle
      ? {
          id: activeCycle.id,
          classification: activeCycle.classification as "EASY" | "MEDIUM" | "HARD",
          currentReview: activeCycle.currentReview,
          totalReviews: activeCycle.totalReviews,
          baseDate: activeCycle.baseDate,
          isFinal: activeCycle.currentReview >= activeCycle.totalReviews,
        }
      : null,
    hasCompletedCycle: pc.reviewCycles.some((c) => c.status === "COMPLETED"),
    flashcard: {
      id: pc.flashcard.id,
      front: pc.flashcard.front,
      back: pc.flashcard.back,
      cardType: (pc.flashcard as unknown as { cardType?: string }).cardType ?? "BASIC",
      topic: pc.flashcard.topic
        ? {
            id: pc.flashcard.topic.id,
            name: pc.flashcard.topic.name,
            subject: {
              id: pc.flashcard.topic.subject.id,
              name: pc.flashcard.topic.subject.name,
            },
          }
        : null,
    },
  }
}
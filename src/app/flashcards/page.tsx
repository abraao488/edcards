import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { FlashcardsReviewView } from "@/components/flashcards-review-view"
import { getReviewQueueCount } from "@/lib/flashcards/upcoming-actions"
import {
  getSubjectsWithTopicCounts,
  getTopicFlashcardsForQuiz,
} from "@/lib/materias/actions"

export const dynamic = "force-dynamic"

interface FlashcardsPageProps {
  searchParams: { topicId?: string }
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

  // Modo consulta por assunto específico (comportamento de /materias)
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
          initialQuizMode={settings?.preferQuizMode ?? false}
          subjects={subjects}
          initialTopicId={topicId}
        />
      )
    }

    const formattedCards = result.flashcards.map((fc) => ({
      id: fc.id,
      currentCycleDay: fc.currentCycleDay,
      firstReviewAt: null,
      isCycleEnded: false,
      difficultyStage: "MEDIUM" as const,
      flashcard: {
        id: fc.id,
        front: fc.front,
        back: fc.back,
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
        initialQuizMode={settings?.preferQuizMode ?? false}
        subjects={subjects}
        initialTopicId={topicId}
        forceQuizMode
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
      initialQuizMode={settings?.preferQuizMode ?? false}
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
  const progressCards = await prisma.progressCard.findMany({
    where: {
      profileId: activeProfile.id,
      nextReviewDate: { lte: new Date() },
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
    },
    orderBy: { nextReviewDate: "asc" },
  })

  // Format progressCards to client components expected types
  return progressCards.map((pc) => ({
    id: pc.id,
    currentCycleDay: pc.currentCycleDay,
    firstReviewAt: pc.firstReviewAt,
    isCycleEnded: pc.isCycleEnded,
    difficultyStage: (pc.difficultyStage as "EASY" | "MEDIUM" | "HARD") || "MEDIUM",
    flashcard: {
      id: pc.flashcard.id,
      front: pc.flashcard.front,
      back: pc.flashcard.back,
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
  }))
}
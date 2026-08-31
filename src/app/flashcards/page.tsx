import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { SRSReviewSession } from "@/components/srs-review-session"
import { getReviewQueueCount } from "@/lib/flashcards/upcoming-actions"

export const dynamic = "force-dynamic"

export default async function FlashcardsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect("/login")
  }

  // Get user with profiles to find active profile and user settings
  const [dbUser, settings, queueCount] = await Promise.all([
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
  ])

  if (!dbUser) {
    redirect("/login")
  }

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
  const formattedCards = progressCards.map((pc) => ({
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

  return (
    <SRSReviewSession
      initialProgressCards={formattedCards}
      userId={dbUser.id}
      email={dbUser.email}
      pomodoroMin={settings?.pomodoroMin ?? 25}
      initialQueueCount={queueCount}
    />
  )
}
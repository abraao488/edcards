import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { getOrCreateActiveProfile } from "@/lib/profile/helpers"
import { ensureProgressCardsForFlashcards } from "@/lib/srs"
import { SRSReviewSession } from "@/components/srs-review-session"
import { getReviewQueueCount } from "@/lib/flashcards/upcoming-actions"
import { CreateCardDialog } from "@/components/create-card-dialog"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export default async function DeckDetailPage({
  params,
}: {
  params: { deckId: string }
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const [activeProfile, settings, deck, queueCount] = await Promise.all([
    getOrCreateActiveProfile(user.id, user.email || ""),
    prisma.userSettings.findUnique({
      where: { userId: user.id },
    }),
    prisma.deck.findUnique({
      where: { id: params.deckId },
      include: {
        cards: {
          select: { id: true },
        },
      },
    }),
    getReviewQueueCount(),
  ])

  if (!deck || deck.userId !== user.id) {
    return (
      <div className="py-20 text-center">
        <p className="text-muted-foreground">Baralho não encontrado.</p>
      </div>
    )
  }

  const flashcardIds = deck.cards.map((c) => c.id)
  const allProgressCards = await ensureProgressCardsForFlashcards(
    activeProfile.id,
    flashcardIds
  )

  // Filter only cards due for review
  const now = new Date()
  const progressCardsWithDate = await prisma.progressCard.findMany({
    where: {
      profileId: activeProfile.id,
      flashcardId: { in: flashcardIds },
      nextReviewDate: { lte: now },
    },
    select: { id: true },
  })
  const dueIds = new Set(progressCardsWithDate.map((pc) => pc.id))
  const dueProgressCards = allProgressCards.filter((pc) => dueIds.has(pc.id))

  return (
    <div>
      <Link
        href="/dashboard/flashcards"
        className="mb-6 flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar aos baralhos
      </Link>

      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground">{deck.name}</h1>
        <CreateCardDialog deckId={deck.id} />
      </div>

      <SRSReviewSession
        initialProgressCards={dueProgressCards}
        userId={user.id}
        email={user.email || ""}
        hideSidebar={true}
        pomodoroMin={settings?.pomodoroMin ?? 25}
        initialQueueCount={queueCount}
      />
    </div>
  )
}
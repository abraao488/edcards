import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { DeckCard } from "@/components/deck-card"
import { CreateDeckDialog } from "@/components/create-deck-dialog"
import { Brain } from "lucide-react"

export default async function FlashcardsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const decks = await prisma.deck.findMany({
    where: { userId: user.id },
    include: {
      _count: { select: { cards: true } },
      cards: {
        where: { nextReview: { lte: today } },
        select: { id: true },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground">Flashcards</h1>
        <CreateDeckDialog />
      </div>

      {decks.length === 0 ? (
        <div className="rounded-xl border border-border bg-card py-12 text-center">
          <Brain className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">
            Nenhum baralho cadastrado. Crie seu primeiro baralho acima.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {decks.map((deck) => (
            <DeckCard
              key={deck.id}
              id={deck.id}
              name={deck.name}
              description={deck.description}
              color={deck.color}
              cardCount={deck._count.cards}
              dueCount={deck.cards.length}
            />
          ))}
        </div>
      )}
    </div>
  )
}

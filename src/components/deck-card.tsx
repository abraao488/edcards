import Link from "next/link"
import { Brain, Trash2 } from "lucide-react"
import { deleteDeck } from "@/lib/flashcards/actions"

interface DeckCardProps {
  id: string
  name: string
  description: string | null
  color: string
  cardCount: number
  dueCount: number
}

export function DeckCard({
  id,
  name,
  description,
  color,
  cardCount,
  dueCount,
}: DeckCardProps) {
  async function handleDelete() {
    await deleteDeck(id)
  }

  return (
    <div className="group relative rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary/50">
      <Link href={`/dashboard/flashcards/${id}`} className="block">
        <div className="mb-4 flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-lg"
            style={{ backgroundColor: `${color}20` }}
          >
            <Brain className="h-5 w-5" style={{ color }} />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">{name}</h3>
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>{cardCount} cards</span>
          {dueCount > 0 && (
            <span className="text-primary">{dueCount} para revisar</span>
          )}
        </div>
      </Link>

      <button
        onClick={handleDelete}
        className="absolute right-4 top-4 rounded-lg p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  )
}

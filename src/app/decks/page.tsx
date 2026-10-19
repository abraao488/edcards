import type { Metadata } from "next"
import Link from "next/link"
import { Brain, Layers } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { SiteFooter } from "@/components/site-footer"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Baralhos públicos de flashcards | Edcards",
  description:
    "Explore baralhos de flashcards públicos criados por concurseiros. Estude de graça e crie os seus com IA e repetição espaçada no Edcards.",
  alternates: { canonical: "/decks" },
}

interface PublicDeckListItem {
  id: string
  name: string
  description: string | null
  color: string
  shareSlug: string
  cardCount: number
}

async function listPublicDecks(): Promise<PublicDeckListItem[]> {
  try {
    const decks = await prisma.deck.findMany({
      where: { isPublic: true, shareSlug: { not: null } },
      select: {
        id: true,
        name: true,
        description: true,
        color: true,
        shareSlug: true,
        _count: { select: { cards: true } },
      },
      orderBy: { publishedAt: "desc" },
      take: 60,
    })

    return decks
      .filter((d): d is typeof d & { shareSlug: string } => d.shareSlug !== null)
      .map((d) => ({
        id: d.id,
        name: d.name,
        description: d.description,
        color: d.color,
        shareSlug: d.shareSlug,
        cardCount: d._count.cards,
      }))
  } catch (err) {
    console.error("[decks] falha ao carregar baralhos públicos:", err)
    return []
  }
}

export default async function DecksPage() {
  const decks = await listPublicDecks()

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <Brain className="h-7 w-7 text-primary" aria-hidden="true" />
            <span className="text-lg font-bold tracking-tight text-foreground">Edcards</span>
          </Link>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 active:scale-[0.98]"
          >
            Criar conta grátis
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-primary/5 via-background to-background px-4 py-10 sm:px-6 sm:py-14">
          <div className="pointer-events-none absolute -top-32 right-0 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative mx-auto max-w-4xl text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
              <Layers className="h-3.5 w-3.5" /> Baralhos públicos
            </div>
            <h1 className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Explore flashcards de outros concurseiros
            </h1>
            <p className="mx-auto mt-3 max-w-2xl text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
              Estude de graça com baralhos compartilhados ou crie os seus com IA e
              repetição espaçada.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
          {decks.length === 0 ? (
            <div className="rounded-xl border border-border bg-card py-12 text-center">
              <Brain className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <p className="text-muted-foreground">
                Ainda não há baralhos públicos. Seja o primeiro a compartilhar.
              </p>
              <Link
                href="/register"
                className="mt-4 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Criar meu baralho
              </Link>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {decks.map((deck) => (
                <Link
                  key={deck.id}
                  href={`/d/${deck.shareSlug}`}
                  className="group rounded-xl border border-border bg-card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg"
                >
                  <div className="mb-3 flex items-center gap-3">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-lg"
                      style={{ backgroundColor: `${deck.color}20` }}
                    >
                      <Brain className="h-5 w-5" style={{ color: deck.color }} />
                    </div>
                    <h2 className="font-semibold tracking-tight text-foreground">
                      {deck.name}
                    </h2>
                  </div>
                  {deck.description && (
                    <p className="mb-3 line-clamp-2 text-sm text-muted-foreground">
                      {deck.description}
                    </p>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {deck.cardCount} card{deck.cardCount !== 1 ? "s" : ""}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}

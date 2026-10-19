import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { sanitizeHtml, stripHtml } from "@/lib/sanitize"
import { getSiteOrigin } from "@/lib/site"
import { PublicDeckView } from "@/components/public-deck-view"

// Página pública: o estado muda quando o dono alterna o compartilhamento
// (toggle liga/desliga), então renderiza sempre a partir do banco.
export const dynamic = "force-dynamic"

const DEFAULT_DESCRIPTION =
  "Estude este baralho de flashcards gratuito com repetição espaçada no Edcards."

async function findPublicDeck(slug: string) {
  if (!slug || slug.length > 80) return null
  return prisma.deck.findFirst({
    where: { shareSlug: slug, isPublic: true },
    select: {
      id: true,
      name: true,
      description: true,
      color: true,
      publishedAt: true,
      cards: {
        select: { id: true, front: true, back: true, cardType: true, order: true },
        orderBy: { order: "asc" },
      },
    },
  })
}

type Params = { params: { slug: string } }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const deck = await findPublicDeck(params.slug)
  const origin = await getSiteOrigin()
  const url = `${origin}/d/${params.slug}`

  if (!deck) {
    return {
      title: "Baralho não encontrado | Edcards",
      robots: { index: false, follow: false },
    }
  }

  const firstCardText = deck.cards[0]?.front
    ? stripHtml(deck.cards[0].front).trim().slice(0, 160)
    : ""
  const description =
    (deck.description?.trim() || undefined) ||
    (firstCardText
      ? `${firstCardText}${firstCardText.length >= 160 ? "…" : ""}`
      : DEFAULT_DESCRIPTION)

  return {
    title: `${deck.name} - Baralho público | Edcards`,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      locale: "pt_BR",
      url,
      siteName: "Edcards",
      title: `${deck.name} - Baralho público | Edcards`,
      description,
    },
    twitter: {
      card: "summary",
      title: `${deck.name} | Edcards`,
      description,
    },
    // Página pública é sempre indexável (só existe quando isPublic = true).
    robots: { index: true, follow: true },
  }
}

export default async function PublicDeckPage({ params }: Params) {
  const deck = await findPublicDeck(params.slug)
  if (!deck) notFound()

  // Os fronts/versos são HTML de editor rico; sanitiza no servidor antes de
  // passar ao client (que usa dangerouslySetInnerHTML).
  const cards = deck.cards.map((card) => ({
    id: card.id,
    front: sanitizeHtml(card.front),
    back: sanitizeHtml(card.back),
    cardType: card.cardType,
  }))

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between px-4 py-4 sm:px-6">
          <a
            href="/"
            className="text-lg font-bold text-foreground transition-opacity hover:opacity-80"
          >
            Edcards
          </a>
          <Link
            href="/register"
            className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/15"
          >
            Criar conta grátis
          </Link>
        </div>
      </header>

      <section className="mx-auto w-full max-w-4xl px-4 pt-8 sm:px-6">
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
          {deck.name}
        </h1>
        {deck.description && (
          <p className="mt-2 text-sm text-muted-foreground">
            {deck.description}
          </p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">
          {cards.length} {cards.length === 1 ? "card" : "cards"} • baralho
          público
        </p>
      </section>

      <PublicDeckView cards={cards} color={deck.color} />

      <section className="mx-auto w-full max-w-4xl px-4 pb-16 sm:px-6">
        <div className="rounded-xl border border-border bg-card p-6 text-center">
          <h2 className="text-lg font-semibold text-foreground">
            Crie seus próprios flashcards
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Com repetição espaçada, o Edcards ajuda você a memorizar mais rápido
            e não esquecer o que estudou.
          </p>
          <Link
            href="/register"
            className="mt-4 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Começar gratuitamente
          </Link>
        </div>
      </section>
    </main>
  )
}

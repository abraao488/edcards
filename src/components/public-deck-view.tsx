"use client"

import { useEffect, useState } from "react"
import { ChevronLeft, ChevronRight, RotateCw } from "lucide-react"

export interface PublicCard {
  id: string
  front: string
  back: string
  cardType: "BASIC" | "REVERSED" | "CLOZE"
}

interface PublicDeckViewProps {
  cards: PublicCard[]
  color: string
}

export function PublicDeckView({ cards, color }: PublicDeckViewProps) {
  const [current, setCurrent] = useState(0)
  const [flipped, setFlipped] = useState(false)

  const total = cards.length
  const card = cards[current]

  useEffect(() => {
    setFlipped(false)
  }, [current])

  function next() {
    if (total === 0) return
    setCurrent((prev) => (prev + 1) % total)
  }

  function prev() {
    if (total === 0) return
    setCurrent((prev) => (prev === 0 ? total - 1 : prev - 1))
  }

  function flip() {
    setFlipped((f) => !f)
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault()
        flip()
      }
      if (e.key === "ArrowRight") next()
      if (e.key === "ArrowLeft") prev()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [current, total])

  if (total === 0) {
    return (
      <section className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground">Este baralho ainda não tem cards.</p>
        </div>
      </section>
    )
  }

  return (
    <section className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground">Visualização</h2>
        <span className="text-sm text-muted-foreground">
          {current + 1} / {total}
        </span>
      </div>

      <button
        type="button"
        onClick={flip}
        className="group relative flex h-[52vh] min-h-[320px] w-full cursor-pointer items-center justify-center overflow-hidden rounded-2xl border border-border bg-card p-4 sm:p-6"
        style={{ boxShadow: `0 0 40px -20px ${color}` }}
        aria-label="Virar flashcard"
      >
        <div className="text-center">
          {flipped ? (
            <div
              className="prose prose-invert max-w-2xl mx-auto prose-p:leading-relaxed prose-p:text-foreground"
              dangerouslySetInnerHTML={{ __html: card.back }}
            />
          ) : (
            <div
              className="prose prose-invert max-w-2xl mx-auto prose-p:leading-relaxed prose-p:text-foreground"
              dangerouslySetInnerHTML={{ __html: card.front }}
            />
          )}
        </div>
        <div className="absolute bottom-4 right-4 rounded-full border border-border bg-background/80 px-3 py-1 text-xs text-muted-foreground backdrop-blur transition-opacity opacity-0 group-hover:opacity-100">
          {flipped ? "Ver frente" : "Ver verso"}
        </div>
      </button>

      <div className="mt-4 flex items-center justify-center gap-3 sm:gap-4">
        <button
          onClick={prev}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground transition-colors hover:bg-secondary active:scale-[0.98]"
        >
          <ChevronLeft className="h-4 w-4" />
          Anterior
        </button>
        <button
          onClick={flip}
          className="flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/15 active:scale-[0.98]"
        >
          <RotateCw className="h-4 w-4" />
          Virar
        </button>
        <button
          onClick={next}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground transition-colors hover:bg-secondary active:scale-[0.98]"
        >
          Próximo
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        Espaço/Enter: virar • ← →: navegar
      </p>
    </section>
  )
}

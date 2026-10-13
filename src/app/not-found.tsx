import Link from "next/link"
import type { Metadata } from "next"
import { Brain, Compass } from "lucide-react"

export const metadata: Metadata = {
  title: "Página não encontrada - Edcards",
  description: "A página que você procura não existe ou foi movida.",
}

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-16">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-8 text-center shadow-[0_0_30px_rgba(0,212,255,0.05)]">
        <div className="mb-4 flex justify-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary">
            <Compass className="h-7 w-7" aria-hidden="true" />
          </span>
        </div>
        <p className="font-mono text-5xl font-extrabold tracking-tighter text-primary">
          404
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground">
          Página não encontrada
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          O endereço que você tentou acessar não existe, foi movido ou está
          indisponível no momento.
        </p>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 sm:w-auto"
          >
            <Brain className="h-4 w-4" aria-hidden="true" />
            Ir para o início
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex w-full items-center justify-center rounded-xl border border-border bg-secondary px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-secondary/70 sm:w-auto"
          >
            Ir para o dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}

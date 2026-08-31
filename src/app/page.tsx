import Link from "next/link"
import { Brain } from "lucide-react"

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="mx-auto max-w-2xl text-center">
        <div className="mb-8 flex items-center justify-center gap-3">
          <Brain className="h-12 w-12 text-primary" />
          <h1 className="text-5xl font-bold text-foreground">Edcards</h1>
        </div>
        <p className="mb-8 text-lg text-muted-foreground">
          Sua plataforma de preparação para concursos públicos com flashcards
          inteligentes e repetição espaçada.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link
            href="/register"
            className="rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Começar Agora
          </Link>
          <Link
            href="/login"
            className="rounded-lg border border-border px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
          >
            Entrar
          </Link>
        </div>
      </div>
    </div>
  )
}

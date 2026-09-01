import Link from "next/link"
import { Brain, Sparkles, CalendarDays, GraduationCap } from "lucide-react"

const benefits = [
  {
    icon: Sparkles,
    title: "Flashcards Gerados por IA",
    description:
      "Crie cards automaticamente a partir de seus próprios materiais de estudo com inteligência artificial.",
  },
  {
    icon: CalendarDays,
    title: "Repetição Espaçada",
    description:
      "Algoritmo SRS inteligente que revisa seus flashcards no momento ideal para fixar o conteúdo na memória de longo prazo.",
  },
  {
    icon: GraduationCap,
    title: "Foco em Concursos Públicos",
    description:
      "Organize por matérias e assuntos do edital, acompanhe sua fila de revisão e estude com foco no que mais importa.",
  },
]

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Hero */}
      <section className="flex flex-1 flex-col items-center justify-center px-4 py-24">
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
      </section>

      {/* Benefits */}
      <section className="border-t border-border bg-card/50 px-4 py-20">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-12 text-center text-3xl font-bold text-foreground">
            Por que usar o Edcards?
          </h2>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {benefits.map((b) => (
              <div
                key={b.title}
                className="rounded-xl border border-border bg-card p-6 text-center"
              >
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <b.icon className="h-6 w-6" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-foreground">
                  {b.title}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {b.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="px-4 py-20">
        <div className="mx-auto max-w-md text-center">
          <h2 className="mb-4 text-3xl font-bold text-foreground">
            Simples e direto
          </h2>
          <p className="mb-8 text-muted-foreground">
            Um único plano com tudo incluso.
          </p>
          <div className="rounded-2xl border border-primary/30 bg-card p-8 shadow-[0_0_30px_rgba(0,212,255,0.1)]">
            <p className="mb-1 text-sm font-medium uppercase tracking-wider text-primary">
              Plano Individual
            </p>
            <div className="mb-6">
              <span className="text-5xl font-bold text-foreground">R$ 15</span>
              <span className="ml-1 text-muted-foreground">/mês</span>
            </div>
            <ul className="mb-8 space-y-3 text-left text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <span className="text-primary">✓</span> Flashcards ilimitados
              </li>
              <li className="flex items-center gap-2">
                <span className="text-primary">✓</span> Geração por IA
              </li>
              <li className="flex items-center gap-2">
                <span className="text-primary">✓</span> Repetição espaçada SRS
              </li>
              <li className="flex items-center gap-2">
                <span className="text-primary">✓</span> Pomodoro integrado
              </li>
            </ul>
            <Link
              href="/register"
              className="block w-full rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Começar Agora
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-4 py-8 text-center text-xs text-muted-foreground">
        &copy; {new Date().getFullYear()} Edcards. Todos os direitos
        reservados.
      </footer>
    </div>
  )
}

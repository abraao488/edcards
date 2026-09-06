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
      {/* Hero — hierarquia + OLED glow sutil + mobile spacing */}
      <section className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-4 py-16 sm:px-6 sm:py-24 lg:py-28">
        <div className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[680px] -translate-x-1/2 rounded-full bg-primary/[0.07] blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-64 w-64 rounded-full bg-purple-500/[0.06] blur-3xl" />
        <div className="relative mx-auto max-w-2xl text-center animate-edcards-in">
          <p className="mb-3 font-mono text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
            Repetição espaçada • IA • Foco total
          </p>
          <div className="mb-6 flex items-center justify-center gap-3 sm:mb-8">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 shadow-[0_0_18px_rgba(0,212,255,0.18)] sm:h-14 sm:w-14">
              <Brain className="h-7 w-7 text-primary sm:h-8 sm:w-8" aria-hidden="true" />
            </span>
            <h1 className="text-4xl font-extrabold tracking-tighter text-foreground sm:text-5xl">Edcards</h1>
          </div>
          <p className="mx-auto mb-8 max-w-xl text-balance text-base leading-relaxed text-muted-foreground sm:text-lg">
            Sua plataforma de preparação para concursos públicos com flashcards
            inteligentes e repetição espaçada. Estude menos, memorize mais.
          </p>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            <Link
              href="/register"
              className="inline-flex w-full cursor-pointer items-center justify-center rounded-xl bg-primary px-7 py-3.5 text-sm font-semibold tracking-tight text-primary-foreground shadow-[0_0_18px_rgba(0,212,255,0.18)] transition-all duration-200 ease-out hover:bg-primary/90 hover:shadow-[0_0_24px_rgba(0,212,255,0.26)] active:scale-[0.98] sm:w-auto"
            >
              Começar Agora
            </Link>
            <Link
              href="/login"
              className="inline-flex w-full cursor-pointer items-center justify-center rounded-xl border border-border bg-card px-7 py-3.5 text-sm font-semibold text-foreground transition-all duration-200 ease-out hover:border-foreground/15 hover:bg-secondary active:scale-[0.98] sm:w-auto"
            >
              Entrar
            </Link>
          </div>
          <p className="mt-4 font-mono text-[11px] text-muted-foreground">Sem cartão no cadastro • Cancele quando quiser</p>
        </div>
      </section>

      {/* Benefits — hierarquia de cards mais clara */}
      <section className="border-t border-border bg-card/40 px-4 py-14 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-5xl">
          <div className="mx-auto mb-8 max-w-2xl text-center sm:mb-12">
            <p className="mb-2 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">Benefícios</p>
            <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Por que usar o Edcards?
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Método validado que transforma seu material em memória de longo prazo
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-3">
            {benefits.map((b) => (
              <div
                key={b.title}
                className="group rounded-xl border border-border bg-card p-6 text-left shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-foreground/10 hover:shadow-lg sm:p-7 sm:text-center"
              >
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-primary/15 bg-primary/10 text-primary transition-transform duration-200 group-hover:scale-[1.04] sm:mx-auto sm:h-12 sm:w-12">
                  <b.icon className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" />
                </div>
                <h3 className="mb-2 text-[15px] font-semibold tracking-tight text-foreground sm:text-lg">
                  {b.title}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {b.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing — hierarquia título/métrica/ação */}
      <section className="px-4 py-14 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-md text-center">
          <p className="mb-2 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">Preço</p>
          <h2 className="mb-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Simples e direto
          </h2>
          <p className="mb-8 text-sm leading-relaxed text-muted-foreground">
            Um único plano com tudo incluso. Sem pegadinhas.
          </p>
          <div className="rounded-2xl border border-primary/25 bg-card p-6 shadow-[0_0_30px_rgba(0,212,255,0.08)] transition-all duration-200 hover:border-primary/35 hover:shadow-[0_0_36px_rgba(0,212,255,0.12)] sm:p-8">
            <p className="mb-1 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
              Plano Individual
            </p>
            <div className="mb-6 flex items-baseline justify-center gap-1">
              <span className="text-5xl font-extrabold tracking-tighter text-foreground">R$ 15</span>
              <span className="text-sm text-muted-foreground">/mês</span>
            </div>
            <ul className="mb-8 space-y-3 text-left text-sm text-muted-foreground">
              <li className="flex items-center gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">✓</span> Flashcards ilimitados
              </li>
              <li className="flex items-center gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">✓</span> Geração por IA
              </li>
              <li className="flex items-center gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">✓</span> Repetição espaçada SRS
              </li>
              <li className="flex items-center gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">✓</span> Pomodoro integrado
              </li>
            </ul>
            <Link
              href="/register"
              className="block w-full cursor-pointer rounded-xl bg-primary px-6 py-3.5 text-sm font-semibold tracking-tight text-primary-foreground shadow-[0_0_16px_rgba(0,212,255,0.16)] transition-all duration-200 ease-out hover:bg-primary/90 hover:shadow-[0_0_22px_rgba(0,212,255,0.22)] active:scale-[0.98]"
            >
              Começar Agora
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-4 py-8 text-center sm:px-6">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 text-xs text-muted-foreground sm:flex-row">
          <span className="inline-flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary/70" aria-hidden="true" /> Edcards
          </span>
          <span>&copy; {new Date().getFullYear()} Edcards. Todos os direitos reservados.</span>
        </div>
      </footer>
    </div>
  )
}

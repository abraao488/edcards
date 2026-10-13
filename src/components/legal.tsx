import type { ReactNode } from "react"

interface LegalArticleProps {
  title: string
  updatedAt: string
  summary?: string
  children: ReactNode
}

/** Casca tipográfica compartilhada pelos documentos legais. */
export function LegalArticle({ title, updatedAt, summary, children }: LegalArticleProps) {
  return (
    <article className="animate-edcards-in">
      <p className="mb-2 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
        Documento legal
      </p>
      <h1 className="text-balance text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
        {title}
      </h1>
      <p className="mt-2 text-xs text-muted-foreground">Última atualização: {updatedAt}</p>
      {summary ? (
        <p className="mt-6 rounded-xl border border-border bg-card/40 p-4 text-sm leading-relaxed text-muted-foreground">
          {summary}
        </p>
      ) : null}
      <div className="mt-8 space-y-8">{children}</div>
    </article>
  )
}

interface LegalSectionProps {
  title: string
  children: ReactNode
}

export function LegalSection({ title, children }: LegalSectionProps) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  )
}

export function LegalList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="list-disc space-y-2 pl-5 marker:text-primary/60">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  )
}

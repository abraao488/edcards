import Link from "next/link"
import { Brain } from "lucide-react"

const LEGAL_LINKS = [
  { href: "/termos", label: "Termos de Uso" },
  { href: "/privacidade", label: "Política de Privacidade" },
  { href: "/reembolso", label: "Política de Reembolso" },
]

export function SiteFooter() {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-border px-4 py-8 sm:px-6">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-5 text-xs text-muted-foreground">
        <nav
          aria-label="Links legais"
          className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2"
        >
          {LEGAL_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="transition-colors duration-200 hover:text-foreground hover:underline"
            >
              {link.label}
            </Link>
          ))}
          <a
            href="mailto:suporte@edcards.com.br"
            className="transition-colors duration-200 hover:text-foreground hover:underline"
          >
            Suporte
          </a>
        </nav>

        <div className="flex flex-col items-center gap-2 text-center sm:flex-row sm:gap-4">
          <span className="inline-flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary/70" aria-hidden="true" /> Edcards
          </span>
          <span>&copy; {year} Edcards. Todos os direitos reservados.</span>
        </div>
      </div>
    </footer>
  )
}

"use client"

import { useState, useTransition } from "react"
import { Check, Link2, Loader2 } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { setDeckPublic } from "@/lib/flashcards/share-actions"

interface DeckShareToggleProps {
  deckId: string
  initialIsPublic: boolean
  initialShareSlug: string | null
}

/**
 * Toggle de compartilhar do baralho. Liga gera/reutiliza o shareSlug no
 * servidor e mostra o link público /d/[slug] para copiar. Desligar mantém o
 * slug (reativar reusa o mesmo link) e esconde a página pública na hora.
 */
export function DeckShareToggle({
  deckId,
  initialIsPublic,
  initialShareSlug,
}: DeckShareToggleProps) {
  const [isPublic, setIsPublic] = useState(initialIsPublic)
  const [shareSlug, setShareSlug] = useState(initialShareSlug)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function shareUrl(slug: string) {
    if (typeof window === "undefined") return `/d/${slug}`
    return `${window.location.origin}/d/${slug}`
  }

  function handleToggle(next: boolean) {
    setError(null)
    setCopied(false)
    // Otimista: reverte se o servidor recusar (ex.: assinatura inativa).
    const prev = { isPublic, shareSlug }
    setIsPublic(next)
    startTransition(async () => {
      try {
        const result = await setDeckPublic(deckId, next)
        setIsPublic(result.isPublic)
        setShareSlug(result.shareSlug)
      } catch {
        setIsPublic(prev.isPublic)
        setShareSlug(prev.shareSlug)
        setError(
          "Não foi possível atualizar o compartilhamento. Tente novamente."
        )
      }
    })
  }

  async function copyLink() {
    if (!shareSlug) return
    try {
      await navigator.clipboard.writeText(shareUrl(shareSlug))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError("Não foi possível copiar o link.")
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-foreground">
            Compartilhar baralho
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Qualquer pessoa com o link pode visualizar os cards, sem precisar de
            conta.
          </p>
        </div>
        <Switch
          checked={isPublic}
          onCheckedChange={(checked: boolean) => handleToggle(checked)}
          disabled={isPending}
          aria-label="Compartilhar baralho publicamente"
        />
      </div>

      {isPublic && shareSlug && (
        <div className="mt-3 flex items-center gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
            <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate text-sm text-muted-foreground">
              {shareUrl(shareSlug)}
            </span>
          </div>
          <button
            type="button"
            onClick={copyLink}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/15 active:scale-[0.98]"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4" /> Copiado
              </>
            ) : (
              "Copiar link"
            )}
          </button>
        </div>
      )}

      {isPending && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Salvando…
        </p>
      )}

      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  )
}

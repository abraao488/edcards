"use client"

import { useState } from "react"
import {
  Share2,
  Globe,
  Lock,
  Copy,
  Check,
  Loader2,
  X,
  ExternalLink,
} from "lucide-react"
import { setDeckPublic } from "@/lib/flashcards/share-actions"

export interface DeckShareDialogProps {
  deckId: string
  deckName: string
  origin: string
  initialIsPublic: boolean
  initialShareSlug: string | null
}

export function DeckShareDialog({
  deckId,
  deckName,
  origin,
  initialIsPublic,
  initialShareSlug,
}: DeckShareDialogProps) {
  const [open, setOpen] = useState(false)
  const [isPublic, setIsPublic] = useState(initialIsPublic)
  const [shareSlug, setShareSlug] = useState(initialShareSlug)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const shareUrl = shareSlug ? `${origin}/d/${shareSlug}` : null
  const whatsappUrl = shareUrl
    ? `https://wa.me/?text=${encodeURIComponent(`${deckName} — Flashcards grátis\n\n${shareUrl}`)}`
    : null
  const telegramUrl = shareUrl
    ? `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(`${deckName} — Flashcards grátis`)}`
    : null
  const xUrl = shareUrl
    ? `https://x.com/intent/tweet?text=${encodeURIComponent(`${deckName} — Flashcards grátis`)}&url=${encodeURIComponent(shareUrl)}`
    : null

  async function toggle(next: boolean) {
    setLoading(true)
    setError(null)
    try {
      const res = await setDeckPublic(deckId, next)
      setIsPublic(res.isPublic)
      setShareSlug(res.shareSlug ?? null)
    } catch {
      setError("Não foi possível atualizar o compartilhamento.")
    } finally {
      setLoading(false)
    }
  }

  async function handleCopy() {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError("Não foi possível copiar o link.")
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-secondary active:scale-[0.98]"
      >
        <Share2 className="h-4 w-4" />
        Compartilhar
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-xl">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Compartilhar baralho</h2>
                <p className="text-sm text-muted-foreground">{deckName}</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg p-1 text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/40 p-4">
                <div className="flex items-center gap-3">
                  {isPublic ? (
                    <Globe className="h-5 w-5 text-primary" />
                  ) : (
                    <Lock className="h-5 w-5 text-muted-foreground" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {isPublic ? "Público" : "Privado"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {isPublic
                        ? "Qualquer pessoa com o link pode visualizar os cards"
                        : "Apenas você consegue ver este baralho"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => toggle(!isPublic)}
                  disabled={loading}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    isPublic ? "bg-primary" : "bg-secondary"
                  } disabled:opacity-50`}
                >
                  {loading ? (
                    <Loader2 className="absolute left-1/2 top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 animate-spin text-white" />
                  ) : (
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        isPublic ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  )}
                </button>
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              {isPublic && shareUrl && (
                <div className="space-y-3">
                  <div className="flex items-stretch gap-2">
                    <div className="flex flex-1 items-center overflow-hidden rounded-lg border border-border bg-secondary px-3 py-2">
                      <p className="truncate text-xs text-muted-foreground">{shareUrl}</p>
                    </div>
                    <button
                      onClick={handleCopy}
                      className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground transition-colors hover:bg-secondary active:scale-[0.98]"
                    >
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      {copied ? "Copiado!" : "Copiar"}
                    </button>
                    <a
                      href={shareUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground transition-colors hover:bg-secondary active:scale-[0.98]"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Abrir
                    </a>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {whatsappUrl && (
                      <a
                        href={whatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-secondary"
                      >
                        WhatsApp
                      </a>
                    )}
                    {telegramUrl && (
                      <a
                        href={telegramUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-secondary"
                      >
                        Telegram
                      </a>
                    )}
                    {xUrl && (
                      <a
                        href={xUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-secondary"
                      >
                        X (Twitter)
                      </a>
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground">
                    O link funciona para quem não tem conta. Ao abrir, verá uma prévia dos cards e um CTA para criar a conta grátis.
                  </p>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 active:scale-[0.98]"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

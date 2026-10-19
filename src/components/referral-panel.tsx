"use client"

import { useState } from "react"
import { Gift, Copy, Check, Share2, Users, Clock, Sparkles } from "lucide-react"
import type { InviteData } from "@/lib/referral/actions"

interface ReferralPanelProps {
  invite: InviteData
}

export function ReferralPanel({ invite }: ReferralPanelProps) {
  const { code, link, summary } = invite
  const [copied, setCopied] = useState<"link" | "code" | null>(null)

  const shareText = `Estou estudando com o Edcards (flashcards com IA + repetição espaçada). Usa meu convite e a gente ganha 1 mês grátis: ${link}`

  async function copy(value: string, kind: "link" | "code") {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(kind)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      // Clipboard indisponível: o usuário ainda pode selecionar manualmente.
    }
  }

  const stats = [
    { icon: Users, label: "Convidados", value: summary.total },
    { icon: Clock, label: "Pendentes", value: summary.pending },
    { icon: Sparkles, label: "Meses ganhos", value: summary.monthsEarned },
  ]

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <div className="mb-3 flex items-center gap-2">
          <Gift className="h-5 w-5 text-primary" aria-hidden="true" />
          <h3 className="text-sm font-semibold tracking-tight text-foreground sm:text-base">
            Seu link de convite
          </h3>
        </div>
        <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
          Convide amigos para o Edcards. Quando alguém entra pelo seu link e
          assina, vocês dois ganham {summary.rewardDays} dias grátis.
        </p>

        <div className="flex items-stretch gap-2">
          <div className="flex min-w-0 flex-1 items-center rounded-lg border border-border bg-background px-3 py-2">
            <span className="truncate text-sm text-muted-foreground">{link}</span>
          </div>
          <button
            type="button"
            onClick={() => copy(link, "link")}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/15 active:scale-[0.98]"
          >
            {copied === "link" ? (
              <>
                <Check className="h-4 w-4" /> Copiado
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" /> Copiar
              </>
            )}
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <a
            href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-secondary"
          >
            <Share2 className="h-3.5 w-3.5" /> WhatsApp
          </a>
          <a
            href={`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(shareText)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-secondary"
          >
            <Share2 className="h-3.5 w-3.5" /> Telegram
          </a>
          <button
            type="button"
            onClick={() => copy(code, "code")}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-secondary"
          >
            {copied === "code" ? (
              <>
                <Check className="h-3.5 w-3.5" /> Código copiado
              </>
            ) : (
              <>Código: {code}</>
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-border bg-card p-4 text-center shadow-sm"
          >
            <s.icon className="mx-auto mb-2 h-5 w-5 text-primary" aria-hidden="true" />
            <p className="text-2xl font-bold tracking-tight text-foreground">
              {s.value}
            </p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <h3 className="mb-2 text-sm font-semibold tracking-tight text-foreground sm:text-base">
          Como funciona
        </h3>
        <ol className="space-y-2 text-sm text-muted-foreground">
          <li>1. Compartilhe seu link com amigos que estudam para concursos.</li>
          <li>2. Eles criam a conta pelo seu link (o convite fica registrado).</li>
          <li>
            3. Quando eles assinam, você e seu amigo ganham {summary.rewardDays} dias
            grátis automaticamente.
          </li>
        </ol>
      </div>
    </div>
  )
}

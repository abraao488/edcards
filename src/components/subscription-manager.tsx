"use client"

import { useState } from "react"
import { CreditCard, QrCode, CheckCircle, Loader2 } from "lucide-react"
import { subscribe } from "@/lib/asaas/actions"

interface SubscriptionStatus {
  active: boolean
  status: string | null
  plan?: string
  paymentMethod?: string | null
  nextBillingDate?: string | null
}

export function SubscriptionManager({ sub }: { sub: SubscriptionStatus | null }) {
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSubscribe(type: "PIX" | "CREDIT_CARD") {
    setLoading(type)
    setError(null)
    try {
      const result = await subscribe(type)
      if (result.paymentUrl) {
        window.open(result.paymentUrl, "_blank")
      } else {
        setError("Link de pagamento não disponível. Tente novamente.")
      }
    } catch {
      setError("Erro ao criar assinatura")
    } finally {
      setLoading(null)
    }
  }

  if (sub?.active) {
    return (
      <div className="rounded-xl border border-green-500/30 bg-green-500/5 p-6">
        <div className="mb-3 flex items-center gap-2">
          <CheckCircle className="h-6 w-6 text-green-400" />
          <h3 className="font-semibold text-foreground">Assinatura Ativa</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Plano: {sub.plan === "premium" ? "Premium" : sub.plan} ·{" "}
          Pagamento: {sub.paymentMethod === "PIX" ? "Pix" : "Cartão de Crédito"}
        </p>
        {sub.nextBillingDate && (
          <p className="text-sm text-muted-foreground">
            Próximo vencimento: {new Date(sub.nextBillingDate).toLocaleDateString("pt-BR")}
          </p>
        )}
      </div>
    )
  }

  if (sub?.status === "PENDING") {
    return (
      <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-6">
        <div className="mb-3 flex items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin text-yellow-400" />
          <h3 className="font-semibold text-foreground">Pagamento Pendente</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Seu pagamento está sendo processado. Assim que confirmado, sua assinatura será ativada.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="mb-2 text-lg font-semibold text-foreground">
          Revisaí Premium
        </h3>
        <p className="mb-6 text-sm text-muted-foreground">
          Acesso ilimitado a todas as funcionalidades da plataforma.
        </p>
        <div className="mb-6 text-center">
          <span className="text-4xl font-bold text-foreground">R$ 15</span>
          <span className="text-muted-foreground">/mês</span>
        </div>
        <ul className="mb-6 space-y-2 text-sm text-muted-foreground">
          <li className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-primary" /> Flashcards ilimitados
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-primary" /> Repetição Espaçada (SRS)
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-primary" /> Upload de PDFs
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-primary" /> Banco de questões
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-primary" /> Simulados cronometrados
          </li>
        </ul>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => handleSubscribe("PIX")}
          disabled={loading !== null}
          className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary/50 hover:bg-primary/5 disabled:opacity-50"
        >
          <QrCode className="h-8 w-8 text-primary" />
          <div>
            <p className="font-semibold text-foreground">Pix</p>
            <p className="text-xs text-muted-foreground">Pagamento à vista</p>
          </div>
          {loading === "PIX" && (
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          )}
        </button>
        <button
          onClick={() => handleSubscribe("CREDIT_CARD")}
          disabled={loading !== null}
          className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary/50 hover:bg-primary/5 disabled:opacity-50"
        >
          <CreditCard className="h-8 w-8 text-primary" />
          <div>
            <p className="font-semibold text-foreground">Cartão</p>
            <p className="text-xs text-muted-foreground">Recorrência mensal</p>
          </div>
          {loading === "CREDIT_CARD" && (
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          )}
        </button>
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  )
}

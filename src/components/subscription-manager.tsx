"use client"

import { useState } from "react"
import { CreditCard, CheckCircle, Loader2, QrCode, Copy, X } from "lucide-react"
import { subscribe, payWithPix } from "@/lib/mercadopago/actions"

interface SubscriptionStatus {
  active: boolean
  status: string | null
  plan?: string
  paymentMethod?: string | null
  nextBillingDate?: string | null
  accessExpiresAt?: string | null
}

export function SubscriptionManager({ sub }: { sub: SubscriptionStatus | null }) {
  const [loading, setLoading] = useState(false)
  const [pixLoading, setPixLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pixData, setPixData] = useState<{
    qrCodeBase64: string | null
    pixCopyPaste: string | null
  } | null>(null)
  const [copied, setCopied] = useState(false)

  async function handleSubscribe() {
    setLoading(true)
    setError(null)
    try {
      const result = await subscribe()
      if (result.initPoint) {
        window.location.href = result.initPoint
      } else {
        setError("Link de pagamento não disponível. Tente novamente.")
      }
    } catch {
      setError("Erro ao criar assinatura")
    } finally {
      setLoading(false)
    }
  }

  async function handlePix() {
    setPixLoading(true)
    setError(null)
    try {
      const result = await payWithPix()
      if (result.qrCodeBase64 || result.pixCopyPaste) {
        setPixData({
          qrCodeBase64: result.qrCodeBase64,
          pixCopyPaste: result.pixCopyPaste,
        })
      } else {
        setError("Não foi possível gerar o QR Code. Tente novamente.")
      }
    } catch {
      setError("Erro ao gerar pagamento Pix")
    } finally {
      setPixLoading(false)
    }
  }

  function handleCopyPix() {
    if (pixData?.pixCopyPaste) {
      navigator.clipboard.writeText(pixData.pixCopyPaste)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (sub?.active) {
    const isPix = sub.paymentMethod === "pix"
    return (
      <div className="rounded-xl border border-green-500/30 bg-green-500/5 p-6">
        <div className="mb-3 flex items-center gap-2">
          <CheckCircle className="h-6 w-6 text-green-400" />
          <h3 className="font-semibold text-foreground">
            {isPix ? "Acesso Ativo (Pix)" : "Assinatura Ativa"}
          </h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Plano: {sub.plan === "premium" ? "Premium" : sub.plan}
        </p>
        {isPix && sub.accessExpiresAt && (
          <p className="text-sm text-muted-foreground">
            Expira em: {new Date(sub.accessExpiresAt).toLocaleDateString("pt-BR")}
          </p>
        )}
        {!isPix && sub.nextBillingDate && (
          <p className="text-sm text-muted-foreground">
            Próximo vencimento: {new Date(sub.nextBillingDate).toLocaleDateString("pt-BR")}
          </p>
        )}
      </div>
    )
  }

  if (sub?.status === "PENDING" && sub.paymentMethod !== "pix") {
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

  if (pixData) {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground">
              Pague com Pix
            </h3>
            <button
              onClick={() => setPixData(null)}
              className="rounded-lg p-1 text-muted-foreground hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <p className="mb-4 text-sm text-muted-foreground">
            Escaneie o QR Code ou copie o código abaixo. O acesso é liberado imediatamente após a confirmação do pagamento (geralmente em poucos segundos).
          </p>

          {pixData.qrCodeBase64 && (
            <div className="mb-4 flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`data:image/png;base64,${pixData.qrCodeBase64}`}
                alt="QR Code Pix"
                className="h-64 w-64 rounded-lg border border-border"
              />
            </div>
          )}

          {pixData.pixCopyPaste && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                Copia e cola:
              </p>
              <div className="flex gap-2">
                <div className="flex-1 overflow-hidden rounded-lg border border-border bg-secondary px-3 py-2">
                  <p className="truncate text-xs text-muted-foreground">
                    {pixData.pixCopyPaste}
                  </p>
                </div>
                <button
                  onClick={handleCopyPix}
                  className="flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground hover:bg-secondary"
                >
                  <Copy className="h-4 w-4" />
                  {copied ? "Copiado!" : "Copiar"}
                </button>
              </div>
            </div>
          )}

          <p className="mt-4 text-xs text-muted-foreground">
            Valor: R$ 15,00 — Acesso por 30 dias, sem renovação automática.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="mb-2 text-lg font-semibold text-foreground">
          Edcards Premium
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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button
          onClick={handleSubscribe}
          disabled={loading || pixLoading}
          className="flex items-center justify-center gap-3 rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/50 hover:bg-primary/5 disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          ) : (
            <CreditCard className="h-6 w-6 text-primary" />
          )}
          <div className="text-left">
            <p className="font-semibold text-foreground">
              {loading ? "Redirecionando..." : "Assinar agora"}
            </p>
            <p className="text-xs text-muted-foreground">Cartão · Recorrente</p>
          </div>
        </button>

        <button
          onClick={handlePix}
          disabled={loading || pixLoading}
          className="flex items-center justify-center gap-3 rounded-xl border border-border bg-card p-5 transition-colors hover:border-green-500/50 hover:bg-green-500/5 disabled:opacity-50"
        >
          {pixLoading ? (
            <Loader2 className="h-6 w-6 animate-spin text-green-400" />
          ) : (
            <QrCode className="h-6 w-6 text-green-400" />
          )}
          <div className="text-left">
            <p className="font-semibold text-foreground">
              {pixLoading ? "Gerando QR Code..." : "Pagar com Pix"}
            </p>
            <p className="text-xs text-muted-foreground">30 dias · Sem renovação</p>
          </div>
        </button>
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  )
}

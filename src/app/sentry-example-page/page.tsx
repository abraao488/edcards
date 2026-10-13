"use client"

import { useState } from "react"
import * as Sentry from "@sentry/nextjs"

/**
 * PÁGINA TEMPORÁRIA DE TESTE — remover após validar a integração com o Sentry.
 * Use os botões para disparar erros de cliente e de servidor e conferir se
 * aparecem no painel do Sentry em "Problemas".
 */
export default function SentryExamplePage() {
  const [serverStatus, setServerStatus] = useState<string | null>(null)

  return (
    <div className="mx-auto max-w-xl space-y-6 p-8">
      <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-300">
        Página temporária de teste do Sentry. Remova-a após a validação.
      </div>

      <h1 className="text-2xl font-bold text-foreground">Sentry — Teste de integração</h1>

      <div className="space-y-3">
        <button
          type="button"
          onClick={() => {
            // Erro não tratado no client → capturado pelo error boundary (error.tsx) + Sentry
            throw new Error("Edcards · erro de teste no CLIENTE (Sentry)")
          }}
          className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          1. Lançar erro no cliente
        </button>

        <button
          type="button"
          onClick={() => {
            // Evento enviado diretamente pelo SDK do browser
            Sentry.captureException(
              new Error("Edcards · erro de teste via captureException (client)")
            )
            alert("Evento capturado no cliente. Confira o Sentry.")
          }}
          className="w-full rounded-lg border border-border bg-secondary px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-secondary/70"
        >
          1b. Enviar evento manual (client)
        </button>

        <button
          type="button"
          onClick={async () => {
            setServerStatus("enviando…")
            try {
              const res = await fetch("/api/sentry-example-api", { cache: "no-store" })
              setServerStatus(`resposta HTTP ${res.status}`)
            } catch (err) {
              setServerStatus(`falhou: ${String(err)}`)
            }
          }}
          className="w-full rounded-lg border border-border bg-secondary px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-secondary/70"
        >
          2. Lançar erro no servidor
        </button>

        {serverStatus && (
          <p className="font-mono text-xs text-muted-foreground">{serverStatus}</p>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Observação: o envio ao Sentry só fica ativo com <code>NODE_ENV=production</code>.
        Para testar localmente em Produção, rode <code>npm run build &amp;&amp; npm start</code>.
      </p>
    </div>
  )
}

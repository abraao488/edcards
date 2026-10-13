"use client"

import { useEffect } from "react"
import * as Sentry from "@sentry/nextjs"

/**
 * Boundary global do Next.js (substitui o root layout quando há falha crítica).
 * Como o layout raiz é substituído, o CSS global não é aplicado — por isso os
 * estilos são inline. Importante: deve reportar o erro ao Sentry.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="pt-BR" className="dark">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#060A14",
          color: "#F2F6FB",
          fontFamily:
            "var(--font-sans), system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          padding: "1rem",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "32rem",
            textAlign: "center",
            borderRadius: "1rem",
            border: "1px solid #1F2733",
            backgroundColor: "#0A0E1A",
            padding: "2rem",
          }}
        >
          <p
            style={{
              margin: "0 0 0.5rem",
              fontSize: "11px",
              fontWeight: 600,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "#FF6B6B",
            }}
          >
            Erro crítico
          </p>
          <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700 }}>
            Não foi possível carregar o aplicativo
          </h1>
          <p
            style={{
              margin: "0.75rem 0 0",
              fontSize: "0.875rem",
              lineHeight: 1.6,
              color: "#9AA7B8",
            }}
          >
            Ocorreu um erro inesperado. A equipe foi notificada automaticamente.
            Tente recarregar a página.
          </p>
          {error.digest ? (
            <p
              style={{
                margin: "0.75rem 0 0",
                fontFamily: "var(--font-mono), monospace",
                fontSize: "11px",
                color: "#66748A",
              }}
            >
              Código do erro: {error.digest}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => reset()}
            style={{
              marginTop: "1.5rem",
              cursor: "pointer",
              border: "none",
              borderRadius: "0.75rem",
              backgroundColor: "#00E5FF",
              color: "#060A14",
              padding: "0.625rem 1.25rem",
              fontSize: "0.875rem",
              fontWeight: 600,
            }}
          >
            Tentar novamente
          </button>
        </div>
      </body>
    </html>
  )
}

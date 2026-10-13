import * as Sentry from "@sentry/nextjs"

/**
 * Hook de instrumentação do Next.js. Necessário para inicializar o Sentry no
 * runtime do servidor (nodejs) e no edge — sem ele os erros de produção do
 * lado servidor não são reportados.
 *
 * No Next.js 14 é preciso habilitar `experimental.instrumentationHook` em
 * next.config.mjs.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config")
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config")
  }
}

// Captura erros de Server Components / Server Actions aninhados (Next 15+).
// Em versões anteriores o export é inofensivo e simplesmente ignorado.
export const onRequestError = Sentry.captureRequestError

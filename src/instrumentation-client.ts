import * as Sentry from "@sentry/nextjs"

/**
 * Inicialização do Sentry no cliente (browser).
 *
 * NOTA: este arquivo precisa se chamar `instrumentation-client.ts` (e não
 * `sentry.client.config.ts`), porque o SDK só detecta o `sentry.client.config.*`
 * na raiz do projeto — em `src/` ele era silenciosamente ignorado no build.
 *
 * O browser só enxerga variáveis com prefixo NEXT_PUBLIC_ (inlined no build),
 * por isso usamos `NEXT_PUBLIC_SENTRY_DSN` com fallback para `SENTRY_DSN`.
 */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN,
  tracesSampleRate: 0.2,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  integrations: [Sentry.replayIntegration()],
  enabled: process.env.NODE_ENV === "production",
})

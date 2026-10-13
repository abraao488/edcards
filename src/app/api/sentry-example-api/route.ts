/**
 * ROTA TEMPORÁRIA DE TESTE — remover após validar a integração com o Sentry.
 * Lança um erro no servidor para confirmar a captura server-side (instrumentation).
 */
export const dynamic = "force-dynamic"

export function GET() {
  throw new Error("Edcards · erro de teste no SERVIDOR (Sentry)")
}

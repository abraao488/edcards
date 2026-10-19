import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"

/**
 * Nomes de eventos de produto rastreados. Fechado de propósito: evita que
 * qualquer string arbitrária vire linha na tabela AnalyticsEvent.
 */
export type AnalyticsEventName =
  | "user_registered"
  | "checkout_started"
  | "subscription_activated"
  | "deck_published"
  | "referral_claimed"
  | "referral_rewarded"
  | "public_deck_cta_clicked"

export const ANALYTICS_EVENT_NAMES: AnalyticsEventName[] = [
  "user_registered",
  "checkout_started",
  "subscription_activated",
  "deck_published",
  "referral_claimed",
  "referral_rewarded",
  "public_deck_cta_clicked",
]

export function isAnalyticsEventName(value: string): value is AnalyticsEventName {
  return (ANALYTICS_EVENT_NAMES as string[]).includes(value)
}

/**
 * Grava um evento de funil. NUNCA lança: analytics não pode derrubar cadastro
 * nem pagamento. Em caso de falha, apenas loga e segue.
 */
export async function recordEvent(
  name: AnalyticsEventName,
  params: {
    userId?: string | null
    properties?: Record<string, unknown>
  } = {}
): Promise<void> {
  try {
    await prisma.analyticsEvent.create({
      data: {
        userId: params.userId ?? null,
        name,
        properties:
          params.properties === undefined
            ? undefined
            : (params.properties as Prisma.InputJsonValue),
      },
    })
  } catch (err) {
    console.error("[analytics] recordEvent falhou:", name, err)
  }
}

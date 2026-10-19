"use server"

import { createClient } from "@/lib/supabase/server"
import { isAnalyticsEventName, recordEvent } from "./events"

/**
 * Server action para o client registrar eventos de funil. O nome é validado
 * contra a lista fechada e o userId é resolvido no servidor (nunca confiamos
 * no client para dizer quem é o usuário).
 */
export async function trackEvent(
  name: string,
  properties?: Record<string, unknown>
): Promise<{ ok: boolean }> {
  if (!isAnalyticsEventName(name)) return { ok: false }

  let userId: string | null = null
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    userId = user?.id ?? null
  } catch {
    userId = null
  }

  await recordEvent(name, { userId, properties })
  return { ok: true }
}

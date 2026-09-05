"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { syncSubscriptionStatus } from "@/lib/mercadopago/actions"

// Rede de segurança: quando a página carrega e existe uma Subscription
// PENDING com mercadopagoId, consulta o status real no Mercado Pago em
// background (sem travar o carregamento) e, se já aprovado/autorizado,
// atualiza o banco na hora e faz refresh da página.
const MAX_ATTEMPTS = 3
const RETRY_DELAYS = [2500, 7000, 12000]

export function SubscriptionStatusSync({
  pendingWithPayment,
}: {
  pendingWithPayment: boolean
}) {
  const router = useRouter()
  const ran = useRef(false)
  const attempt = useRef(0)

  useEffect(() => {
    if (!pendingWithPayment || ran.current) return
    ran.current = true

    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    async function attemptSync() {
      try {
        const result = await syncSubscriptionStatus()
        if (cancelled) return
        attempt.current += 1

        console.log(
          "[SubscriptionSync] attempt",
          attempt.current,
          "->",
          result
        )

        if (result?.updated) {
          router.refresh()
          return
        }

        if (attempt.current < MAX_ATTEMPTS) {
          const delay = RETRY_DELAYS[attempt.current - 1] ?? RETRY_DELAYS.at(-1)!
          timer = setTimeout(attemptSync, delay)
        }
      } catch (err) {
        console.error("[SubscriptionSync] sync failed:", err)
      }
    }

    attemptSync()

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [pendingWithPayment, router])

  return null
}
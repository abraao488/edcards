import { prisma } from "@/lib/prisma"
import { recordEvent } from "@/lib/analytics/events"
import { grantReferralReward } from "@/lib/referral/service"

export const PIX_ACCESS_DAYS = 30

// ID de pagamento Pix é numérico; preapproval (cartão/assinatura) é
// alfanumérico. Usado para não confundir as duas referências.
function isPixPaymentId(value: string | null): value is string {
  return value !== null && /^\d+$/.test(value)
}

export async function activatePixAccess(userId: string, paymentId: string) {
  const now = new Date()
  const accessExpiresAt = new Date(now)
  accessExpiresAt.setDate(now.getDate() + PIX_ACCESS_DAYS)
  const nextBillingDate = new Date(now)
  nextBillingDate.setDate(nextBillingDate.getDate() + PIX_ACCESS_DAYS)

  const existing = await prisma.subscription.findUnique({
    where: { userId },
  })

  if (existing) {
    // Nunca sobrescreve a referência de um Pix já pago (status ACTIVE +
    // paymentMethod pix + ID numérico). Se o registro atual guardava outra
    // coisa — ex.: o ID de uma tentativa de cartão/assinatura criada depois —
    // passamos a apontar para o pagamento Pix aprovado que liberou o acesso.
    const hasPaidPixReference =
      existing.paymentMethod === "pix" &&
      existing.status === "ACTIVE" &&
      isPixPaymentId(existing.mercadopagoId)

    await prisma.subscription.update({
      where: { userId },
      data: {
        status: "ACTIVE",
        paymentMethod: "pix",
        accessExpiresAt,
        nextBillingDate,
        mercadopagoId: hasPaidPixReference
          ? existing.mercadopagoId
          : paymentId,
      },
    })
  } else {
    await prisma.subscription.create({
      data: {
        userId,
        mercadopagoId: paymentId,
        status: "ACTIVE",
        paymentMethod: "pix",
        accessExpiresAt,
        nextBillingDate,
      },
    })
  }

  await recordEvent("subscription_activated", {
    userId,
    properties: { method: "pix" },
  })
  // Idempotente: só recompensa a indicação uma vez por indicado.
  await grantReferralReward(userId)

  return accessExpiresAt
}

/**
 * Revoga o acesso do usuário associado a um pagamento/assinatura.
 * Usada pelo webhook nos eventos refunded e charged_back.
 *
 * Procura a assinatura primeiro pelo mercadopagoId (payment ou preapproval)
 * e, se não encontrar, pelo userId vindo do external_reference do pagamento.
 *
 * Zera accessExpiresAt/nextBillingDate junto com o status CANCELED: sem isso
 * o acesso continuaria ativo, pois ele é considerado vigente por status OU
 * por data de expiração.
 */
export async function revokeAccess(
  mercadopagoId: string,
  userId?: string | null
): Promise<{ updated: boolean; status: "CANCELED" | null }> {
  const existing =
    (await prisma.subscription.findUnique({ where: { mercadopagoId } })) ??
    (userId
      ? await prisma.subscription.findUnique({ where: { userId } })
      : null)

  if (!existing) return { updated: false, status: null }

  if (
    existing.status === "CANCELED" &&
    !existing.accessExpiresAt &&
    !existing.nextBillingDate
  ) {
    return { updated: false, status: "CANCELED" }
  }

  await prisma.subscription.update({
    where: { userId: existing.userId },
    data: {
      status: "CANCELED",
      accessExpiresAt: null,
      nextBillingDate: null,
    },
  })

  return { updated: true, status: "CANCELED" }
}

export async function applyPreApprovalStatus(preApproval: {
  id: string
  status: string
  next_payment_date?: string | null
}) {
  const statusMap: Record<string, "ACTIVE" | "PENDING" | "CANCELED"> = {
    authorized: "ACTIVE",
    paused: "PENDING",
    cancelled: "CANCELED",
  }
  const newStatus = statusMap[preApproval.status] ?? "PENDING"

  const existing = await prisma.subscription.findUnique({
    where: { mercadopagoId: preApproval.id },
  })
  if (!existing) {
    // Não é o preapproval principal: pode ser o que ficou guardado em
    // pendingMercadopagoId (tentativa de cartão feita com Pix ainda ativo).
    return applyPendingPreApproval(preApproval, newStatus)
  }

  const now = new Date()
  const fallbackNextBilling = new Date(now)
  fallbackNextBilling.setDate(fallbackNextBilling.getDate() + PIX_ACCESS_DAYS)

  await prisma.subscription.update({
    where: { mercadopagoId: preApproval.id },
    data: {
      status: newStatus,
      // Cancelado = acesso revogado: limpa as datas para o status
      // CANCELED realmente bloquear (ver revokeAccess).
      accessExpiresAt: newStatus === "CANCELED" ? null : undefined,
      nextBillingDate:
        newStatus === "CANCELED"
          ? null
          : preApproval.next_payment_date
            ? new Date(preApproval.next_payment_date)
            : newStatus === "ACTIVE"
              ? fallbackNextBilling
              : undefined,
    },
  })

  if (newStatus === "ACTIVE") {
    await recordEvent("subscription_activated", {
      userId: existing.userId,
      properties: { method: "subscription" },
    })
    await grantReferralReward(existing.userId)
  }

  return { updated: true, status: newStatus }
}

/**
 * O preapproval de cartão criado por subscribe() enquanto o Pix ainda estava
 * ativo fica guardado em pendingMercadopagoId, sem tocar no acesso. Uma
 * cobrança de cartão da assinatura pode chegar pelo webhook sem o evento de
 * preapproval correspondente: buscamos aqui a referência pendente do usuário
 * para disparar a mesma promoção a partir do pagamento.
 */
export async function findPendingPreApprovalId(
  userId: string
): Promise<string | null> {
  if (!userId) return null
  const sub = await prisma.subscription.findUnique({ where: { userId } })
  return sub?.pendingMercadopagoId ?? null
}

/**
 * Caso pendingMercadopagoId: preapproval de cartão criado enquanto o Pix
 * continuava ativo. Nunca mexe no acesso do Pix.
 *
 * - Cartão cancelado/rejeitado → descarta só a referência pendente.
 * - Pix ainda vigente          → mantém tudo; fica para o próximo evento.
 * - Pix expirado               → promove o preapproval para mercadopagoId e
 *   assume a assinatura (status/paymentMethod/nextBillingDate), limpando o
 *   accessExpiresAt do Pix.
 */
async function applyPendingPreApproval(
  preApproval: {
    id: string
    status: string
    next_payment_date?: string | null
  },
  newStatus: "ACTIVE" | "PENDING" | "CANCELED"
): Promise<{ updated: boolean; status: "ACTIVE" | "PENDING" | "CANCELED" }> {
  const pending = await prisma.subscription.findUnique({
    where: { pendingMercadopagoId: preApproval.id },
  })
  if (!pending) return { updated: false, status: newStatus }

  const deadAttempt =
    preApproval.status === "cancelled" || preApproval.status === "rejected"
  if (deadAttempt) {
    await prisma.subscription.update({
      where: { userId: pending.userId },
      data: { pendingMercadopagoId: null },
    })
    return { updated: false, status: pending.status }
  }

  const pixStillActive =
    pending.accessExpiresAt !== null && pending.accessExpiresAt > new Date()
  if (pixStillActive) return { updated: false, status: pending.status }

  const now = new Date()
  const fallbackNextBilling = new Date(now)
  fallbackNextBilling.setDate(fallbackNextBilling.getDate() + PIX_ACCESS_DAYS)

  await prisma.subscription.update({
    where: { userId: pending.userId },
    data: {
      // Pix expirou: a assinatura de cartão vira a referência principal.
      mercadopagoId: preApproval.id,
      pendingMercadopagoId: null,
      status: newStatus,
      paymentMethod: "subscription",
      accessExpiresAt: null,
      nextBillingDate:
        newStatus === "CANCELED"
          ? null
          : preApproval.next_payment_date
            ? new Date(preApproval.next_payment_date)
            : newStatus === "ACTIVE"
              ? fallbackNextBilling
              : null,
    },
  })

  if (newStatus === "ACTIVE") {
    await recordEvent("subscription_activated", {
      userId: pending.userId,
      properties: { method: "subscription" },
    })
    await grantReferralReward(pending.userId)
  }

  return { updated: true, status: newStatus }
}

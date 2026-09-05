import { prisma } from "@/lib/prisma"

export const PIX_ACCESS_DAYS = 30

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
    await prisma.subscription.update({
      where: { userId },
      data: {
        status: "ACTIVE",
        paymentMethod: "pix",
        accessExpiresAt,
        nextBillingDate,
        mercadopagoId: existing.mercadopagoId || paymentId,
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

  return accessExpiresAt
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
    return { updated: false, status: newStatus }
  }

  const now = new Date()
  const fallbackNextBilling = new Date(now)
  fallbackNextBilling.setDate(fallbackNextBilling.getDate() + PIX_ACCESS_DAYS)

  await prisma.subscription.update({
    where: { mercadopagoId: preApproval.id },
    data: {
      status: newStatus,
      nextBillingDate: preApproval.next_payment_date
        ? new Date(preApproval.next_payment_date)
        : newStatus === "ACTIVE"
          ? fallbackNextBilling
          : undefined,
    },
  })

  return { updated: true, status: newStatus }
}
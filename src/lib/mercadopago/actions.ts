"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { createSubscription, createPixPayment, getPayment, getPreApproval } from "./client"
import { activatePixAccess, applyPreApprovalStatus } from "./sync"

const PIX_AMOUNT = 15
const PIX_DESCRIPTION = "Edcards Premium — Acesso 30 dias"

export async function subscribe() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const email = user.email
  if (!email) throw new Error("Email não encontrado")

  const result = await createSubscription({
    payerEmail: email,
    reason: "Edcards Premium",
    externalReference: user.id,
  })

  const existingSub = await prisma.subscription.findUnique({
    where: { userId: user.id },
  })

  if (existingSub) {
    await prisma.subscription.update({
      where: { userId: user.id },
      data: {
        mercadopagoId: result.id,
        status: "PENDING",
        paymentMethod: "subscription",
      },
    })
  } else {
    await prisma.subscription.create({
      data: {
        userId: user.id,
        mercadopagoId: result.id,
        status: "PENDING",
        paymentMethod: "subscription",
      },
    })
  }

  revalidatePath("/dashboard/configuracoes")

  return {
    subscriptionId: result.id,
    initPoint: result.init_point,
  }
}

export async function payWithPix() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const email = user.email
  if (!email) throw new Error("Email não encontrado")

  const result = await createPixPayment({
    amount: PIX_AMOUNT,
    description: PIX_DESCRIPTION,
    externalReference: user.id,
    payerEmail: email,
  })

  const existingSub = await prisma.subscription.findUnique({
    where: { userId: user.id },
  })

  const pixData = result.point_of_interaction?.transaction_data

  if (existingSub) {
    await prisma.subscription.update({
      where: { userId: user.id },
      data: {
        mercadopagoId: String(result.id),
        status: "PENDING",
        paymentMethod: "pix",
      },
    })
  } else {
    await prisma.subscription.create({
      data: {
        userId: user.id,
        mercadopagoId: String(result.id),
        status: "PENDING",
        paymentMethod: "pix",
      },
    })
  }

  revalidatePath("/dashboard/configuracoes")

  return {
    qrCodeBase64: pixData?.qr_code_base64 || null,
    pixCopyPaste: pixData?.qr_code || null,
    paymentId: result.id,
  }
}

export async function getSubscriptionStatus() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const sub = await prisma.subscription.findUnique({
    where: { userId: user.id },
  })

  if (!sub) return { active: false, status: null }

  const hasActiveAccess =
    sub.status === "ACTIVE" ||
    (sub.accessExpiresAt && sub.accessExpiresAt > new Date())

  return {
    active: hasActiveAccess,
    status: sub.status,
    plan: sub.plan,
    paymentMethod: sub.paymentMethod,
    nextBillingDate: sub.nextBillingDate,
    accessExpiresAt: sub.accessExpiresAt,
  }
}

export async function syncSubscriptionStatus() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { synced: false, reason: "unauthenticated" }

  const sub = await prisma.subscription.findUnique({
    where: { userId: user.id },
  })
  if (!sub) return { synced: false, reason: "no_subscription" }
  if (sub.status !== "PENDING" || !sub.mercadopagoId) {
    return { synced: false, reason: "not_pending", status: sub.status }
  }

  const isPix =
    sub.paymentMethod === "pix" || /^\d+$/.test(sub.mercadopagoId)

  try {
    if (isPix) {
      const payment = await getPayment(Number(sub.mercadopagoId))
      console.log(
        "[MercadoPago] sync: pix check payment",
        sub.mercadopagoId,
        "status:",
        payment.status
      )
      if (payment.status === "approved") {
        const accessExpiresAt = await activatePixAccess(
          user.id,
          sub.mercadopagoId
        )
        revalidatePath("/dashboard/configuracoes")
        revalidatePath("/bem-vindo")
        return { synced: true, updated: true, status: "ACTIVE", accessExpiresAt }
      }
      return { synced: true, updated: false, status: payment.status }
    }

    const preApproval = await getPreApproval(sub.mercadopagoId)
    console.log(
      "[MercadoPago] sync: preapproval check",
      sub.mercadopagoId,
      "status:",
      preApproval.status
    )
    const result = await applyPreApprovalStatus(preApproval)
    if (result.updated) {
      revalidatePath("/dashboard/configuracoes")
      revalidatePath("/bem-vindo")
    }
    return { synced: true, updated: result.updated, status: result.status }
  } catch (err) {
    console.error("[MercadoPago] syncSubscriptionStatus failed:", err)
    return { synced: false, reason: "api_error" }
  }
}

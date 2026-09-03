"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { createSubscription, createPixPayment } from "./client"

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

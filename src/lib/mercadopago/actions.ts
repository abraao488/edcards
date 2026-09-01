"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { createSubscription } from "./client"

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
      },
    })
  } else {
    await prisma.subscription.create({
      data: {
        userId: user.id,
        mercadopagoId: result.id,
        status: "PENDING",
      },
    })
  }

  revalidatePath("/dashboard/configuracoes")

  return {
    subscriptionId: result.id,
    initPoint: result.init_point,
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
  return {
    active: sub.status === "ACTIVE",
    status: sub.status,
    plan: sub.plan,
    paymentMethod: sub.paymentMethod,
    nextBillingDate: sub.nextBillingDate,
  }
}

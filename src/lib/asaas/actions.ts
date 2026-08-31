"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { createCustomer, findCustomer, createSubscription } from "./client"

export async function subscribe(billingType: "PIX" | "CREDIT_CARD") {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const email = user.email
  if (!email) throw new Error("Email não encontrado")

  let asaasCustomer = await findCustomer(email)

  if (!asaasCustomer) {
    asaasCustomer = await createCustomer({
      name: email.split("@")[0],
      email,
    })
  }

  const nextDueDate = new Date()
  nextDueDate.setDate(nextDueDate.getDate() + 1)

  const subscription = await createSubscription({
    customer: asaasCustomer.id,
    value: 15,
    nextDueDate: nextDueDate.toISOString().split("T")[0],
    cycle: "MONTHLY",
    billingType,
  })

  const existingSub = await prisma.subscription.findUnique({
    where: { userId: user.id },
  })

  if (existingSub) {
    await prisma.subscription.update({
      where: { userId: user.id },
      data: {
        asaasId: subscription.id,
        status: "PENDING",
        paymentMethod: billingType,
      },
    })
  } else {
    await prisma.subscription.create({
      data: {
        userId: user.id,
        asaasId: subscription.id,
        status: "PENDING",
        paymentMethod: billingType,
      },
    })
  }

  revalidatePath("/dashboard/configuracoes")

  return {
    subscriptionId: subscription.id,
    paymentUrl: subscription.paymentLink || subscription.url || null,
  }
}

export async function getSubscriptionStatus() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
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

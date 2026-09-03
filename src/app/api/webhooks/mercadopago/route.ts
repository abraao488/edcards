import { NextResponse } from "next/server"
import * as Sentry from "@sentry/nextjs"
import crypto from "crypto"
import { prisma } from "@/lib/prisma"
import { getPreApproval, getPayment } from "@/lib/mercadopago/client"

const PIX_ACCESS_DAYS = 30

function verifySignature(
  body: string,
  ts: string | null,
  v1: string | null,
  requestId: string | null
): boolean {
  if (!ts || !v1 || !requestId) return false

  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET
  if (!secret) {
    console.error("[Webhook MP] MERCADOPAGO_WEBHOOK_SECRET not configured")
    return false
  }

  const template = `id:${requestId};request-id:${requestId};ts:${ts};`
  const hmac = crypto.createHmac("sha256", secret).update(template).digest("hex")

  return hmac === v1
}

async function handlePixPayment(paymentId: number) {
  const payment = await getPayment(paymentId)

  if (payment.status !== "approved") {
    console.log("[Webhook MP] Pix payment not approved:", paymentId, payment.status)
    return
  }

  if (payment.payment_method_id !== "pix") {
    console.log("[Webhook MP] Payment is not Pix:", paymentId, payment.payment_method_id)
    return
  }

  const externalRef = payment.external_reference
  if (!externalRef) {
    console.error("[Webhook MP] Pix payment missing external_reference:", paymentId)
    return
  }

  const now = new Date()
  const accessExpiresAt = new Date(now)
  accessExpiresAt.setDate(now.getDate() + PIX_ACCESS_DAYS)
  const nextBillingDate = new Date(now)
  nextBillingDate.setDate(nextBillingDate.getDate() + PIX_ACCESS_DAYS)

  const existingSub = await prisma.subscription.findUnique({
    where: { userId: externalRef },
  })

  if (existingSub) {
    await prisma.subscription.update({
      where: { userId: externalRef },
      data: {
        status: "ACTIVE",
        paymentMethod: "pix",
        accessExpiresAt,
        nextBillingDate,
        mercadopagoId: existingSub.mercadopagoId || String(paymentId),
      },
    })
  } else {
    await prisma.subscription.create({
      data: {
        userId: externalRef,
        mercadopagoId: String(paymentId),
        status: "ACTIVE",
        paymentMethod: "pix",
        accessExpiresAt,
        nextBillingDate,
      },
    })
  }

  console.log("[Webhook MP] Pix payment processed for user:", externalRef, "expires:", accessExpiresAt)
}

async function handlePreApproval(preApprovalId: string) {
  const preApproval = await getPreApproval(preApprovalId)

  const statusMap: Record<string, string> = {
    authorized: "ACTIVE",
    paused: "PENDING",
    cancelled: "CANCELED",
  }

  const newStatus = statusMap[preApproval.status] || "PENDING"

  const now = new Date()
  const fallbackNextBilling = new Date(now)
  fallbackNextBilling.setDate(fallbackNextBilling.getDate() + PIX_ACCESS_DAYS)

  await prisma.subscription.update({
    where: { mercadopagoId: preApprovalId },
    data: {
      status: newStatus as "ACTIVE" | "PENDING" | "CANCELED",
      nextBillingDate: preApproval.next_payment_date
        ? new Date(preApproval.next_payment_date)
        : newStatus === "ACTIVE"
          ? fallbackNextBilling
          : undefined,
    },
  })
}

export async function POST(request: Request) {
  const rawBody = await request.text()

  const ts = request.headers.get("x-ts")
  const v1 = request.headers.get("x-signature")
  const requestId = request.headers.get("x-request-id")

  if (!verifySignature(rawBody, ts, v1, requestId)) {
    console.error("[Webhook MP] Invalid signature")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body
  try {
    body = JSON.parse(rawBody)
  } catch {
    console.error("[Webhook MP] Invalid JSON body")
    return NextResponse.json({ error: "Invalid body" }, { status: 400 })
  }

  const { action, data } = body

  if (!data?.id) {
    return NextResponse.json({ error: "Missing data.id" }, { status: 400 })
  }

  try {
    const isPaymentEvent = typeof action === "string" && action.startsWith("payment.")

    if (isPaymentEvent) {
      await handlePixPayment(Number(data.id))
    } else {
      await handlePreApproval(String(data.id))
    }
  } catch (err) {
    console.error("[Webhook MP] Error processing event:", action, data.id, err)
    Sentry.captureException(err, {
      tags: { source: "webhook/mercadopago", action },
      extra: { eventId: data.id },
    })
  }

  return NextResponse.json({ received: true })
}

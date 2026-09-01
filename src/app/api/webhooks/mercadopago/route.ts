import { NextResponse } from "next/server"
import * as Sentry from "@sentry/nextjs"
import crypto from "crypto"
import { prisma } from "@/lib/prisma"
import { getPreApproval } from "@/lib/mercadopago/client"

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
    const preApproval = await getPreApproval(data.id)

    const statusMap: Record<string, string> = {
      authorized: "ACTIVE",
      paused: "PENDING",
      cancelled: "CANCELED",
    }

    const newStatus = statusMap[preApproval.status] || "PENDING"

    await prisma.subscription.update({
      where: { mercadopagoId: data.id },
      data: {
        status: newStatus as "ACTIVE" | "PENDING" | "CANCELED",
        nextBillingDate: preApproval.next_payment_date
          ? new Date(preApproval.next_payment_date)
          : undefined,
      },
    })
  } catch (err) {
    console.error("[Webhook MP] Error processing preapproval:", data.id, err)
    Sentry.captureException(err, {
      tags: { source: "webhook/mercadopago", action },
      extra: { preapprovalId: data.id },
    })
  }

  return NextResponse.json({ received: true })
}

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(request: Request) {
  const body = await request.json()
  const token = request.headers.get("asaas-access-token")

  if (token !== process.env.ASAAS_WEBHOOK_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { event, subscription } = body

  if (!subscription?.id) {
    return NextResponse.json({ error: "Missing subscription id" }, { status: 400 })
  }

  try {
    switch (event) {
      case "PAYMENT_RECEIVED":
      case "PAYMENT_CONFIRMED":
        await prisma.subscription.update({
          where: { asaasId: subscription.id },
          data: {
            status: "ACTIVE",
            nextBillingDate: subscription.nextDueDate
              ? new Date(subscription.nextDueDate)
              : undefined,
          },
        })
        break

      case "SUBSCRIPTION_CANCELED":
      case "SUBSCRIPTION_DELETED":
        await prisma.subscription.update({
          where: { asaasId: subscription.id },
          data: { status: "CANCELED" },
        })
        break

      case "INVOICE_UPDATED":
        if (subscription.status === "OVERDUE") {
          await prisma.subscription.update({
            where: { asaasId: subscription.id },
            data: { status: "PENDING" },
          })
        }
        break

      default:
        break
    }
  } catch (err) {
    console.error("[Webhook] Error processing event:", event, err)
  }

  return NextResponse.json({ received: true })
}

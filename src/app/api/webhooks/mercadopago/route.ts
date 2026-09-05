import { NextResponse } from "next/server"
import * as Sentry from "@sentry/nextjs"
import crypto from "crypto"
import {
  getPreApproval,
  getPayment,
} from "@/lib/mercadopago/client"
import {
  activatePixAccess,
  applyPreApprovalStatus,
} from "@/lib/mercadopago/sync"

interface SignatureParts {
  ts: string | null
  v1: string | null
}

function parseSignatureHeader(
  header: string | null
): SignatureParts {
  let ts: string | null = null
  let v1: string | null = null
  if (!header) return { ts, v1 }

  for (const part of header.split(",")) {
    const eq = part.indexOf("=")
    if (eq === -1) continue
    const key = part.substring(0, eq).trim().toLowerCase()
    const value = part.substring(eq + 1).trim()
    if (!key || !value) continue
    if (key === "ts") ts = value
    else if (/^v\d+$/.test(key)) v1 = value
  }

  return { ts, v1 }
}

// Manifesto conforme documentação oficial do Mercado Pago:
//   id:{data.id};request-id:{x-request-id};ts:{ts};
// Pares com valor vazio são omitidos; o manifesto sempre termina com ";".
function buildManifest(
  dataId: string | null,
  requestId: string | null,
  ts: string
): string {
  const parts: string[] = []
  if (dataId) parts.push(`id:${dataId}`)
  if (requestId) parts.push(`request-id:${requestId}`)
  parts.push(`ts:${ts}`)
  return parts.join(";") + ";"
}

function computeHmac(
  dataId: string | null,
  requestId: string | null,
  ts: string | null
): { manifest: string; computed: string } | null {
  if (!ts) return null
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET
  if (!secret) return null

  const manifest = buildManifest(dataId, requestId, ts)
  const computed = crypto
    .createHmac("sha256", secret)
    .update(manifest)
    .digest("hex")

  return { manifest, computed }
}

function slowEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

// Preapproval IDs do Mercado Pago são alfanuméricos; alguns SDKs da
// comunidade normalizam para minúsculas antes do HMAC. Para dar robustez,
// além do data.id exatamente como recebido (body e query), também testamos a
// variante minúscula quando fizer sentido. Qualquer tentativa só é aceita se
// a assinatura HMAC bater com o segredo — não abre brecha de segurança.
function signatureCandidates(dataId: string | null): string[] {
  const candidates = new Set<string>()
  if (!dataId) return []

  candidates.add(dataId)

  const lowered = dataId.toLowerCase()
  if (lowered !== dataId && /^[a-zA-Z0-9]+$/.test(dataId)) {
    candidates.add(lowered)
  }

  return Array.from(candidates)
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

  const expiresAt = await activatePixAccess(externalRef, String(paymentId))
  console.log("[Webhook MP] Pix payment processed for user:", externalRef, "expires:", expiresAt)
}

async function handlePreApproval(preApprovalId: string) {
  const preApproval = await getPreApproval(preApprovalId)
  const result = await applyPreApprovalStatus(preApproval)
  console.log(
    "[Webhook MP] Preapproval synced:",
    preApprovalId,
    "status:",
    result.status,
    "updated:",
    result.updated
  )
}

export async function POST(request: Request) {
  const rawBody = await request.text()

  const url = new URL(request.url)
  const queryDataId = url.searchParams.get("data.id")

  const headers: Record<string, string> = {}
  request.headers.forEach((value, key) => {
    headers[key] = value
  })

  const xSignatureRaw = request.headers.get("x-signature")
  const xRequestId = request.headers.get("x-request-id")
  const { ts, v1 } = parseSignatureHeader(xSignatureRaw)

  let body: {
    action?: unknown
    type?: unknown
    data?: { id?: unknown }
  } | null = null
  try {
    body = JSON.parse(rawBody)
  } catch {
    // body stays null, logged below
  }

  const bodyDataId = body?.data?.id != null ? String(body.data.id) : null

  // ============ LOG COMPLETO ANTES DE QUALQUER VALIDAÇÃO ============
  console.log("[Webhook MP] ============ INCOMING WEBHOOK ============")
  console.log("[Webhook MP] method:", request.method)
  console.log("[Webhook MP] url:", request.url)
  console.log(
    "[Webhook MP] query params:",
    JSON.stringify(Object.fromEntries(url.searchParams.entries()))
  )
  console.log("[Webhook MP] query data.id:", JSON.stringify(queryDataId))
  console.log("[Webhook MP] body data.id:", JSON.stringify(bodyDataId))
  console.log("[Webhook MP] body:", rawBody)
  console.log("[Webhook MP] headers (todos):", JSON.stringify(headers, null, 2))
  console.log("[Webhook MP] x-signature raw:", JSON.stringify(xSignatureRaw))
  console.log("[Webhook MP] x-request-id raw:", JSON.stringify(xRequestId))
  console.log("[Webhook MP] parsed ts:", JSON.stringify(ts))
  console.log("[Webhook MP] parsed v1:", JSON.stringify(v1))
  console.log(
    "[Webhook MP] MERCADOPAGO_WEBHOOK_SECRET configured:",
    Boolean(process.env.MERCADOPAGO_WEBHOOK_SECRET),
    "| length:",
    process.env.MERCADOPAGO_WEBHOOK_SECRET?.length ?? 0
  )
  // ==================================================================

  // Verificação de assinatura: o Mercado Pago assina o manifesto usando o
  // data.id do evento. Na prática, o id chega no corpo (data.id) e pode
  // também aparecer como query param (?data.id=...). Testamos ambas as
  // fontes (e variante em minúsculas, usado por SDKs da comunidade) para
  // aceitar qualquer formato real enviado pelo MP.
  const candidates = [
    ...signatureCandidates(bodyDataId),
    ...signatureCandidates(queryDataId),
  ]

  let signatureValid = false
  const attempts: Array<{ dataId: string | null; manifest: string; computed: string }> = []

  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET

  if (!ts || !v1 || !secret) {
    console.error("[Webhook MP] Signature inputs missing -> cannot verify")
  } else {
    const seen = new Set<string>()
    for (const dataId of candidates) {
      const result = computeHmac(dataId, xRequestId, ts)
      if (!result) continue

      const key = `${dataId}|${xRequestId}|${ts}`
      if (seen.has(key)) continue
      seen.add(key)

      attempts.push({ dataId, manifest: result.manifest, computed: result.computed })

      console.log("[Webhook MP] manifest attempt:", {
        dataId,
        manifest: result.manifest,
        expected: result.computed,
        received: v1,
        match: slowEquals(result.computed, v1),
      })

      if (slowEquals(result.computed, v1)) {
        signatureValid = true
        break
      }
    }
    console.log(
      "[Webhook MP] merchant secret used (first 8 chars):",
      secret.slice(0, 8) + "..."
    )
    console.log(
      "[Webhook MP] signature attempts:",
      attempts.length,
      "| valid:",
      signatureValid
    )
  }

  if (!signatureValid) {
    console.error("[Webhook MP] Invalid signature -> rejecting 401")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!body) {
    console.error("[Webhook MP] Invalid JSON body -> rejecting 400")
    return NextResponse.json({ error: "Invalid body" }, { status: 400 })
  }

  const { action, type, data } = body

  if (!data?.id) {
    console.error("[Webhook MP] Missing data.id -> rejecting 400")
    return NextResponse.json({ error: "Missing data.id" }, { status: 400 })
  }

  const eventType =
    typeof type === "string" && type.length > 0
      ? type
      : typeof action === "string"
        ? action.split(".")[0]
        : null

  console.log(
    "[Webhook MP] event type:",
    eventType,
    "| action:",
    action,
    "| data.id:",
    data.id
  )

  try {
    const isPaymentEvent = eventType === "payment"
    const isPreApprovalEvent =
      eventType === "subscription_preapproval" ||
      (typeof action === "string" && action.startsWith("subscription_preapproval"))

    if (isPaymentEvent) {
      await handlePixPayment(Number(data.id))
    } else if (isPreApprovalEvent) {
      await handlePreApproval(String(data.id))
    } else {
      console.log(
        "[Webhook MP] Unhandled event type, acknowledging:",
        eventType,
        action
      )
    }
  } catch (err) {
    console.error(
      "[Webhook MP] Error processing event:",
      { action, type, eventId: data.id },
      err
    )
    Sentry.captureException(err, {
      tags: { source: "webhook/mercadopago", action: String(action ?? "") },
      extra: { eventId: data.id },
    })
  }

  return NextResponse.json({ received: true })
}
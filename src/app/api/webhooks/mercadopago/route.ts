import { NextResponse } from "next/server"
import * as Sentry from "@sentry/nextjs"
import crypto from "crypto"
import {
  getAuthorizedPayment,
  getPayment,
  getPreApproval,
} from "@/lib/mercadopago/client"
import {
  activatePixAccess,
  applyPreApprovalStatus,
  findPendingPreApprovalId,
  revokeAccess,
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

// Sufixos de ação do Mercado Pago que indicam estorno ou chargeback.
const REVOKING_SUFFIXES = [
  "refunded",
  "charge_refunded",
  "charged_back",
  "charge_back",
  "chargeback",
]

function isRevokingAction(action: string | null): boolean {
  if (!action) return false
  const suffix = action.split(".").pop()?.toLowerCase() ?? ""
  return REVOKING_SUFFIXES.includes(suffix) || suffix.includes("refund")
}

// Pagamento aprovado do Mercado Pago. Pix libera o acesso direto; um pagamento
// de cartão de assinatura (que pode chegar sem o evento de preapproval)
// dispara a mesma promoção do preapproval pendente.
async function handlePayment(paymentId: number) {
  const payment = await getPayment(paymentId)

  if (payment.status !== "approved") {
    console.log("[Webhook MP] payment not approved:", paymentId, payment.status)
    return
  }

  if (payment.payment_method_id === "pix") {
    const externalRef = payment.external_reference
    if (!externalRef) {
      console.error("[Webhook MP] Pix payment missing external_reference:", paymentId)
      return
    }

    const expiresAt = await activatePixAccess(externalRef, String(paymentId))
    console.log("[Webhook MP] Pix payment processed for user:", externalRef, "expires:", expiresAt)
    return
  }

  // Cobrança de cartão: o evento de pagamento pode chegar sem o preapproval.
  // Resolve o preapproval ligado ao pagamento e reaplica o status — promove o
  // pendingMercadopagoId quando o Pix já tiver expirado.
  const preApprovalId = await resolvePreApprovalFromPayment(payment)
  if (!preApprovalId) {
    console.log(
      "[Webhook MP] non-Pix payment without pending preapproval:",
      paymentId,
      payment.payment_method_id
    )
    return
  }

  await handlePreApproval(preApprovalId)
}

// Descobre o preapproval por trás de uma cobrança de cartão. O Mercado Pago
// costuma expor `metadata.preapproval_id` no pagamento; se não vier, usa o
// external_reference (o userId gravado em subscribe()) para achar o
// preapproval pendente daquele usuário.
async function resolvePreApprovalFromPayment(payment: {
  metadata?: Record<string, unknown> | null
  external_reference?: unknown
}): Promise<string | null> {
  const fromMetadata =
    payment.metadata &&
    typeof payment.metadata.preapproval_id === "string" &&
    payment.metadata.preapproval_id.length > 0
      ? payment.metadata.preapproval_id
      : null
  if (fromMetadata) return fromMetadata

  const userId =
    typeof payment.external_reference === "string" && payment.external_reference
      ? payment.external_reference
      : null
  if (!userId) return null

  return findPendingPreApprovalId(userId)
}

// Fatura de assinatura (subscription_authorized_payment): evento de cobrança
// recorrente do cartão. Se a cobrança foi aprovada, reaplica o status do
// preapproval vinculado com a mesma regra de promoção.
async function handleAuthorizedPayment(authorizedPaymentId: number) {
  const invoice = await getAuthorizedPayment(authorizedPaymentId)

  if (invoice.payment?.status !== "approved") {
    console.log(
      "[Webhook MP] authorized payment not approved:",
      authorizedPaymentId,
      invoice.payment?.status
    )
    return
  }

  const preApprovalId = invoice.preapproval_id
  if (!preApprovalId) {
    console.error(
      "[Webhook MP] authorized payment missing preapproval_id:",
      authorizedPaymentId
    )
    return
  }

  await handlePreApproval(preApprovalId)
}

// Estorno ou chargeback: revoga o acesso do usuário (status CANCELED e
// expiração zerada). Vale para Pix e para cobranças de assinatura — o dono
// do acesso sai do external_reference do pagamento.
async function handleRevokedPayment(paymentId: number, action: string) {
  const payment = await getPayment(paymentId)

  const externalRef =
    typeof payment.external_reference === "string" && payment.external_reference
      ? payment.external_reference
      : null

  const result = await revokeAccess(String(paymentId), externalRef)

  console.log("[Webhook MP] payment revoked:", {
    paymentId,
    action,
    updated: result.updated,
    status: result.status,
  })
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
  const receivedType = typeof body?.type === "string" ? body.type : null
  const receivedAction = typeof body?.action === "string" ? body.action : null

  // Log resumido: apenas o tipo do evento. Nunca corpo bruto, headers,
  // assinatura ou segredo.
  console.log("[Webhook MP] event received:", {
    type: receivedType,
    action: receivedAction,
  })

  // Verificação de assinatura: o Mercado Pago assina o manifesto usando o
  // data.id do evento. Na prática, o id chega no corpo (data.id) e pode
  // também aparecer como query param (?data.id=...). Testamos ambas as
  // fontes (e variante em minúsculas, usado por SDKs da comunidade) para
  // aceitar qualquer formato real enviado pelo MP.
  const candidates = [
    ...signatureCandidates(bodyDataId),
    ...signatureCandidates(queryDataId),
  ]

  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET

  if (!ts || !v1 || !secret) {
    console.error("[Webhook MP] signature: missing inputs -> rejected (401)")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let signatureValid = false
  let attempts = 0
  const seen = new Set<string>()

  for (const dataId of candidates) {
    const result = computeHmac(dataId, xRequestId, ts)
    if (!result) continue

    const key = `${dataId}|${xRequestId}|${ts}`
    if (seen.has(key)) continue
    seen.add(key)

    attempts++

    if (slowEquals(result.computed, v1)) {
      signatureValid = true
      break
    }
  }

  console.log("[Webhook MP] signature:", {
    attempts,
    accepted: signatureValid,
  })

  if (!signatureValid) {
    console.error("[Webhook MP] signature: rejected (401)")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!body) {
    console.error("[Webhook MP] invalid JSON body -> rejected (400)")
    return NextResponse.json({ error: "Invalid body" }, { status: 400 })
  }

  const { action, type, data } = body

  if (!data?.id) {
    console.error("[Webhook MP] missing data.id -> rejected (400)")
    return NextResponse.json({ error: "Missing data.id" }, { status: 400 })
  }

  const eventType =
    typeof type === "string" && type.length > 0
      ? type
      : typeof action === "string"
        ? action.split(".")[0]
        : null

  const actionStr = typeof action === "string" ? action : null

  try {
    const isRevocation = isRevokingAction(actionStr)
    const isPaymentEvent = eventType === "payment"
    const isAuthorizedPaymentEvent =
      eventType === "subscription_authorized_payment" ||
      (actionStr !== null &&
        actionStr.startsWith("subscription_authorized_payment"))
    const isPreApprovalEvent =
      eventType === "subscription_preapproval" ||
      (actionStr !== null && actionStr.startsWith("subscription_preapproval"))

    if (isRevocation) {
      await handleRevokedPayment(Number(data.id), actionStr ?? "unknown")
    } else if (isPaymentEvent) {
      await handlePayment(Number(data.id))
    } else if (isAuthorizedPaymentEvent) {
      await handleAuthorizedPayment(Number(data.id))
    } else if (isPreApprovalEvent) {
      await handlePreApproval(String(data.id))
    } else {
      console.log("[Webhook MP] unhandled event, acknowledged:", {
        type: eventType,
        action: actionStr,
      })
    }

    console.log("[Webhook MP] event processed:", {
      type: eventType,
      action: actionStr,
      accepted: true,
    })
  } catch (err) {
    console.error("[Webhook MP] processing failed:", {
      type: eventType,
      action: actionStr,
      eventId: data.id,
      message: err instanceof Error ? err.message : String(err),
    })
    Sentry.captureException(err, {
      tags: { source: "webhook/mercadopago", action: actionStr ?? "" },
      extra: { eventId: data.id },
    })
  }

  return NextResponse.json({ received: true })
}

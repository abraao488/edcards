const MERCADOPAGO_BASE = "https://api.mercadopago.com"

interface CreateSubscriptionParams {
  payerEmail: string
  reason: string
  externalReference: string
}

interface SubscriptionResponse {
  id: string
  init_point: string
  status: string
}

interface CreatePixPaymentParams {
  amount: number
  description: string
  externalReference: string
  payerEmail: string
}

export interface PixPaymentResponse {
  id: number
  status: string
  transaction_details?: {
    total_paid_amount?: number
  }
  point_of_interaction?: {
    transaction_data?: {
      qr_code_base64?: string
      qr_code?: string
      ticket_url?: string
    }
  }
}

export async function createSubscription({
  payerEmail,
  reason,
  externalReference,
}: CreateSubscriptionParams): Promise<SubscriptionResponse> {
  const res = await fetch(`${MERCADOPAGO_BASE}/preapproval`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      reason,
      external_reference: externalReference,
      payer_email: payerEmail,
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: 15,
        currency_id: "BRL",
      },
      back_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/configuracoes`,
      status: "pending",
    }),
    signal: AbortSignal.timeout(15000),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error("[MercadoPago] createSubscription failed:", res.status, err)
    throw new Error(`Mercado Pago API error: ${res.status} - ${err}`)
  }

  return res.json()
}

export async function getPreApproval(id: string) {
  const res = await fetch(`${MERCADOPAGO_BASE}/preapproval/${id}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
    },
    signal: AbortSignal.timeout(15000),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error("[MercadoPago] getPreApproval failed:", res.status, err)
    throw new Error(`Mercado Pago API error: ${res.status} - ${err}`)
  }

  return res.json()
}

export async function createPixPayment({
  amount,
  description,
  externalReference,
  payerEmail,
}: CreatePixPaymentParams): Promise<PixPaymentResponse> {
  const res = await fetch(`${MERCADOPAGO_BASE}/v1/payments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
      "X-Idempotency-Key": crypto.randomUUID(),
    },
    body: JSON.stringify({
      transaction_amount: amount,
      description,
      external_reference: externalReference,
      payment_method_id: "pix",
      payer: {
        email: payerEmail,
      },
    }),
    signal: AbortSignal.timeout(30000),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error("[MercadoPago] createPixPayment failed:", res.status, err)
    throw new Error(`Mercado Pago API error: ${res.status} - ${err}`)
  }

  return res.json()
}

export async function getPayment(id: number) {
  const res = await fetch(`${MERCADOPAGO_BASE}/v1/payments/${id}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
    },
    signal: AbortSignal.timeout(15000),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error("[MercadoPago] getPayment failed:", res.status, err)
    throw new Error(`Mercado Pago API error: ${res.status} - ${err}`)
  }

  return res.json()
}

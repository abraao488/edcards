const ASAAS_BASE = process.env.ASAAS_API_URL || "https://api.asaas.com/v3"

async function request(path: string, options: RequestInit = {}) {
  const res = await fetch(`${ASAAS_BASE}${path}`, {
    ...options,
    signal: AbortSignal.timeout(15000),
    headers: {
      "Content-Type": "application/json",
      access_token: process.env.ASAAS_API_KEY!,
      ...options.headers,
    },
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Asaas API error: ${res.status} - ${err}`)
  }
  return res.json()
}

interface CreateCustomerInput {
  name: string
  email: string
  cpfCnpj?: string
}

interface CreateSubscriptionInput {
  customer: string
  value: number
  nextDueDate: string
  cycle: "MONTHLY"
  billingType: "PIX" | "CREDIT_CARD"
}

export async function createCustomer(data: CreateCustomerInput) {
  return request("/customers", {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export async function findCustomer(email: string) {
  const result = await request(`/customers?email=${encodeURIComponent(email)}`)
  return result.data?.[0] || null
}

export async function createSubscription(data: CreateSubscriptionInput) {
  return request("/subscriptions", {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export async function getSubscription(id: string) {
  return request(`/subscriptions/${id}`)
}

export async function getPaymentLink(subscriptionId: string) {
  return request(`/subscriptions/${subscriptionId}/paymentLink`)
}

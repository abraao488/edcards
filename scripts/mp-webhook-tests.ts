/**
 * Testes dos webhooks do Mercado Pago — promoção do preapproval pendente.
 *
 * Roda contra o banco real com usuários descartáveis (removidos no final).
 * Uso: npx tsx scripts/mp-webhook-tests.ts
 *
 * O que é testado (só a lógica de webhook, sem tocar em página/componente):
 *
 *   Cenário pedido 1) Pix ativo + cartão tenta assinar + webhook de
 *     preapproval chega depois do Pix expirar  -> promove.
 *   Cenário pedido 2) o mesmo, mas chegando um webhook de PAGAMENTO do cartão
 *     em vez de preapproval                    -> promove igual.
 *
 * Além disso cobrimos a cobrança recorrente (subscription_authorized_payment)
 * e os guards: Pix vigente não promove e pagamento não aprovado não promove.
 *
 * A rota importa getPayment/getPreApproval/getAuthorizedPayment do client do
 * Mercado Pago. Mockamos SÓ esse módulo via require.cache (mesma técnica do
 * srs-tests-a-k.ts), então a assinatura HMAC, o dispatch de eventos e a
 * persistência rodam de verdade contra o banco.
 */
import "dotenv/config"
import crypto from "node:crypto"
import { prisma } from "@/lib/prisma"

// ---------------------------------------------------------- mock do MP client
type PaymentLike = {
  id: number
  status: string
  payment_method_id: string
  external_reference?: string | null
  metadata?: Record<string, unknown> | null
}
type PreApprovalLike = {
  id: string
  status: string
  next_payment_date?: string | null
}
type AuthorizedPaymentLike = {
  id: number
  preapproval_id?: string
  status?: string
  payment?: { id?: number; status?: string } | null
}

const mockState: {
  payment: PaymentLike | null
  preApproval: PreApprovalLike | null
  authorizedPayment: AuthorizedPaymentLike | null
} = { payment: null, preApproval: null, authorizedPayment: null }

function mockMercadoPagoClient() {
  const clientFile = require.resolve("@/lib/mercadopago/client")
  delete require.cache[clientFile]
  require.cache[clientFile] = {
    id: clientFile,
    filename: clientFile,
    loaded: true,
    exports: {
      getPayment: async () => mockState.payment,
      getPreApproval: async () => mockState.preApproval,
      getAuthorizedPayment: async () => mockState.authorizedPayment,
      createSubscription: async () => ({}),
      createPixPayment: async () => ({}),
    },
    children: [],
    paths: [],
  } as unknown as NodeModule
}

// ------------------------------------------------------------- infra de teste
const results: Promise<{ name: string; ok: boolean; detail?: string }>[] = []
let testChain: Promise<void> = Promise.resolve()

function test(name: string, fn: () => Promise<void> | void) {
  const p = testChain.then(fn).then(
    () => ({ name, ok: true as const }),
    (err: unknown) => ({ name, ok: false as const, detail: (err as Error).message })
  )
  testChain = p.then(() => undefined)
  results.push(p)
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg)
}

function eq(actual: unknown, expected: unknown, label: string) {
  const a = actual instanceof Date ? actual.toISOString() : JSON.stringify(actual)
  const e = expected instanceof Date ? expected.toISOString() : JSON.stringify(expected)
  if (a !== e) throw new Error(`${label}: esperado ${e}, obtido ${a}`)
}

const futureDate = (days = 30) => new Date(Date.now() + days * 86400_000)
const pastDate = (days = 1) => new Date(Date.now() - days * 86400_000)
const newPreApprovalId = () => crypto.randomUUID().replace(/-/g, "")

// ----------------------------------------------------------------- assinatura
type Route = typeof import("@/app/api/webhooks/mercadopago/route")
let POST: Route["POST"]

function signedRequest(body: object): Request {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET
  assert(!!secret, "MERCADOPAGO_WEBHOOK_SECRET ausente no .env")
  const ts = String(Math.floor(Date.now() / 1000))
  const rid = `test-${crypto.randomUUID()}`
  const dataId = String((body as { data?: { id?: unknown } }).data?.id ?? "")
  const manifest = `id:${dataId};request-id:${rid};ts:${ts};`
  const v1 = crypto.createHmac("sha256", secret!).update(manifest).digest("hex")

  return new Request("https://edcards.test/api/webhooks/mercadopago", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-signature": `ts=${ts},v1=${v1}`,
      "x-request-id": rid,
    },
    body: JSON.stringify(body),
  })
}

async function fire(body: object) {
  const res = await POST(signedRequest(body))
  return res.status
}

// ------------------------------------------------------------- mundo de teste
async function createUser() {
  const userId = `test-${crypto.randomUUID()}`
  await prisma.user.create({
    data: { id: userId, email: `${userId}@edcards.test` },
  })
  return userId
}

/**
 * Reproduz o estado que subscribe() deixa quando o cartão tenta assinar com o
 * Pix ainda ativo: acesso Pix vigente + preapproval guardado em
 * pendingMercadopagoId. Depois "expira" o Pix, como o tempo faria.
 */
async function createPixAtivoComCartaoPendente(opts: {
  preapprovalId: string
  pixPaymentId: string
  expire: boolean
}) {
  const userId = await createUser()
  await prisma.subscription.create({
    data: {
      userId,
      mercadopagoId: opts.pixPaymentId,
      status: "ACTIVE",
      paymentMethod: "pix",
      accessExpiresAt: futureDate(20),
      nextBillingDate: futureDate(20),
      pendingMercadopagoId: opts.preapprovalId,
    },
  })
  if (opts.expire) {
    await prisma.subscription.update({
      where: { userId },
      data: { accessExpiresAt: pastDate(1), nextBillingDate: pastDate(1) },
    })
  }
  return userId
}

const subByUser = (userId: string) =>
  prisma.subscription.findUnique({ where: { userId } })

function assertPromovido(
  sub: {
    mercadopagoId: string | null
    pendingMercadopagoId: string | null
    status: string
    paymentMethod: string | null
    accessExpiresAt: Date | null
    nextBillingDate: Date | null
  } | null,
  preapprovalId: string,
  nextPaymentDate: string
) {
  assert(!!sub, "assinatura existe")
  const s = sub!
  eq(s.mercadopagoId, preapprovalId, "mercadopagoId virou o preapproval")
  eq(s.pendingMercadopagoId, null, "pendingMercadopagoId limpo")
  eq(s.status, "ACTIVE", "status ACTIVE")
  eq(s.paymentMethod, "subscription", "paymentMethod subscription")
  eq(s.accessExpiresAt, null, "accessExpiresAt do Pix limpo")
  eq(s.nextBillingDate?.toISOString(), new Date(nextPaymentDate).toISOString(), "nextBillingDate")
}

function assertPixIntacto(
  sub: {
    mercadopagoId: string | null
    pendingMercadopagoId: string | null
    status: string
    paymentMethod: string | null
    accessExpiresAt: Date | null
  } | null,
  pixPaymentId: string,
  preapprovalId: string,
  expiresAt: Date
) {
  assert(!!sub, "assinatura existe")
  const s = sub!
  eq(s.mercadopagoId, pixPaymentId, "mercadopagoId continua o Pix")
  eq(s.pendingMercadopagoId, preapprovalId, "preapproval segue pendente")
  eq(s.status, "ACTIVE", "status ACTIVE")
  eq(s.paymentMethod, "pix", "paymentMethod pix")
  eq(s.accessExpiresAt?.toISOString(), expiresAt.toISOString(), "accessExpiresAt preservado")
}

// ---------------------------------------------------------------------- main
async function main() {
  mockMercadoPagoClient()
  const route = await import("@/app/api/webhooks/mercadopago/route")
  POST = route.POST

  const created: string[] = []

  // =========================================================== cenário pedido 1
  test("1) Pix expirado + webhook de PREAPPROVAL -> promove o cartão", async () => {
    const preapprovalId = newPreApprovalId()
    const userId = await createPixAtivoComCartaoPendente({
      preapprovalId,
      pixPaymentId: "123450001",
      expire: true,
    })
    created.push(userId)

    const next = futureDate(30).toISOString()
    mockState.preApproval = { id: preapprovalId, status: "authorized", next_payment_date: next }

    const status = await fire({
      type: "subscription_preapproval",
      action: "subscription_preapproval.updated",
      data: { id: preapprovalId },
    })
    eq(status, 200, "HTTP 200")

    assertPromovido(await subByUser(userId), preapprovalId, next)
  })

  // =========================================================== cenário pedido 2
  test("2) Pix expirado + webhook de PAGAMENTO do cartão -> promove igual", async () => {
    const preapprovalId = newPreApprovalId()
    const userId = await createPixAtivoComCartaoPendente({
      preapprovalId,
      pixPaymentId: "123450002",
      expire: true,
    })
    created.push(userId)

    const next = futureDate(30).toISOString()
    // Pagamento de cartão sem metadata: o vínculo vem do external_reference
    // (userId gravado em subscribe()).
    mockState.payment = {
      id: 998877001,
      status: "approved",
      payment_method_id: "visa",
      external_reference: userId,
      metadata: {},
    }
    mockState.preApproval = { id: preapprovalId, status: "authorized", next_payment_date: next }

    const status = await fire({
      type: "payment",
      action: "payment.created",
      data: { id: 998877001 },
    })
    eq(status, 200, "HTTP 200")

    assertPromovido(await subByUser(userId), preapprovalId, next)
  })

  // ============================================== variante: metadata.preapproval_id
  test("3) Pix expirado + pagamento de cartão com metadata.preapproval_id -> promove", async () => {
    const preapprovalId = newPreApprovalId()
    const userId = await createPixAtivoComCartaoPendente({
      preapprovalId,
      pixPaymentId: "123450003",
      expire: true,
    })
    created.push(userId)

    const next = futureDate(30).toISOString()
    mockState.payment = {
      id: 998877002,
      status: "approved",
      payment_method_id: "master",
      external_reference: null,
      metadata: { preapproval_id: preapprovalId },
    }
    mockState.preApproval = { id: preapprovalId, status: "authorized", next_payment_date: next }

    const status = await fire({ type: "payment", data: { id: 998877002 } })
    eq(status, 200, "HTTP 200")

    assertPromovido(await subByUser(userId), preapprovalId, next)
  })

  // ================================== evento de cobrança recorrente (fatura)
  test("4) Pix expirado + subscription_authorized_payment aprovado -> promove", async () => {
    const preapprovalId = newPreApprovalId()
    const userId = await createPixAtivoComCartaoPendente({
      preapprovalId,
      pixPaymentId: "123450004",
      expire: true,
    })
    created.push(userId)

    const next = futureDate(30).toISOString()
    mockState.authorizedPayment = {
      id: 555000111,
      preapproval_id: preapprovalId,
      status: "processed",
      payment: { id: 998877003, status: "approved" },
    }
    mockState.preApproval = { id: preapprovalId, status: "authorized", next_payment_date: next }

    const status = await fire({
      type: "subscription_authorized_payment",
      action: "subscription_authorized_payment.created",
      data: { id: 555000111 },
    })
    eq(status, 200, "HTTP 200")

    assertPromovido(await subByUser(userId), preapprovalId, next)
  })

  // ==================================================== guard: Pix ainda vigente
  test("5) Pix ainda vigente + pagamento de cartão -> NÃO promove", async () => {
    const preapprovalId = newPreApprovalId()
    const pixPaymentId = "123450005"
    const userId = await createPixAtivoComCartaoPendente({
      preapprovalId,
      pixPaymentId,
      expire: false,
    })
    created.push(userId)

    const before = await subByUser(userId)

    mockState.payment = {
      id: 998877004,
      status: "approved",
      payment_method_id: "visa",
      external_reference: userId,
      metadata: {},
    }
    mockState.preApproval = { id: preapprovalId, status: "authorized", next_payment_date: futureDate(30).toISOString() }

    const status = await fire({ type: "payment", data: { id: 998877004 } })
    eq(status, 200, "HTTP 200")

    assertPixIntacto(await subByUser(userId), pixPaymentId, preapprovalId, before!.accessExpiresAt!)
  })

  // =============================================== guard: pagamento não aprovado
  test("6) Pix expirado + pagamento de cartão NÃO aprovado -> não promove", async () => {
    const preapprovalId = newPreApprovalId()
    const pixPaymentId = "123450006"
    const userId = await createPixAtivoComCartaoPendente({
      preapprovalId,
      pixPaymentId,
      expire: true,
    })
    created.push(userId)

    mockState.payment = {
      id: 998877005,
      status: "rejected",
      payment_method_id: "visa",
      external_reference: userId,
      metadata: {},
    }
    mockState.preApproval = { id: preapprovalId, status: "authorized", next_payment_date: futureDate(30).toISOString() }

    const status = await fire({ type: "payment", data: { id: 998877005 } })
    eq(status, 200, "HTTP 200")

    const sub = await subByUser(userId)
    eq(sub?.pendingMercadopagoId, preapprovalId, "preapproval continua pendente")
    assert(sub?.mercadopagoId === pixPaymentId, "mercadopagoId continua o Pix")
  })

  // ---------------------------------------------------------------- resultados
  const resolved = await Promise.all(results)
  for (const r of resolved) {
    console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.detail ? `\n      -> ${r.detail}` : ""}`)
  }
  const failed = resolved.filter((r) => !r.ok).length
  console.log(`\nResultado: ${resolved.length - failed}/${resolved.length} testes passaram.`)

  for (const id of created) {
    await prisma.user.delete({ where: { id } }).catch(() => undefined)
  }
  await prisma.$disconnect()
  process.exit(failed > 0 ? 1 : 0)
}

main().catch(async (err) => {
  console.error("Falha crítica no harness:", err)
  await prisma.$disconnect().catch(() => undefined)
  process.exit(1)
})

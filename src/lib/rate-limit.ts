import { headers } from "next/headers"

/**
 * Rate limiting simples em memória para as actions de autenticação.
 *
 * Conta tentativas por chave (e-mail ou IP) numa janela de tempo e bloqueia
 * temporariamente após o limite. O estado é por instância do servidor — em
 * deploy serverless isso é "best effort" (cada instância tem seu contador),
 * mas já suficiente para frear força-bruta óbvia na mesma conexão/request.
 *
 * ATENÇÃO: este módulo não pode ter "use server" — os exports virariam
 * server actions públicas.
 */

const WINDOW_MS = 15 * 60 * 1000 // 15 minutos por janela
const BLOCK_MS = 15 * 60 * 1000 // bloqueio temporário de 15 minutos
const MAX_TRACKED_KEYS = 1000 // limite de chaves em memória (evita crescimento infinito)

type AttemptEntry = {
  count: number
  windowStart: number
  blockedUntil: number
}

const attempts = new Map<string, AttemptEntry>()

function pruneIfNeeded(nowMs: number) {
  if (attempts.size < MAX_TRACKED_KEYS) return
  // forEach em vez de for..of: o projeto compila com target < es2015
  attempts.forEach((entry, key) => {
    const expired =
      nowMs - entry.windowStart > WINDOW_MS && entry.blockedUntil < nowMs
    if (expired) attempts.delete(key)
  })
}

/** true = chave está bloqueada agora (tempo de bloqueio ainda não expirou). */
export function isRateLimited(key: string): boolean {
  const nowMs = Date.now()
  const entry = attempts.get(key)
  if (!entry) return false

  if (entry.blockedUntil > nowMs) return true

  // Janela expirada → zera
  if (nowMs - entry.windowStart > WINDOW_MS) {
    attempts.delete(key)
  }
  return false
}

/**
 * Registra uma tentativa (falha ou criação de conta). Ao atingir
 * `maxAttempts` dentro da janela, a chave passa a ficar bloqueada por BLOCK_MS.
 */
export function registerFailedAttempt(key: string, maxAttempts = 5): void {
  const nowMs = Date.now()
  pruneIfNeeded(nowMs)

  const entry = attempts.get(key)
  if (!entry) {
    // Mapa cheio: não rastreia chaves novas (evita descartar contadores ativos)
    if (attempts.size >= MAX_TRACKED_KEYS) return
    attempts.set(key, { count: 1, windowStart: nowMs, blockedUntil: 0 })
    return
  }

  // Janela expirada → reinicia a contagem
  if (nowMs - entry.windowStart > WINDOW_MS) {
    entry.count = 1
    entry.windowStart = nowMs
    entry.blockedUntil = 0
    return
  }

  entry.count += 1
  if (entry.count >= maxAttempts) {
    entry.blockedUntil = nowMs + BLOCK_MS
  }
}

/** Limpa o contador (ex.: login bem-sucedido). */
export function clearAttempts(key: string): void {
  attempts.delete(key)
}

/**
 * IP do cliente a partir dos headers da request (proxy do Vercel/nginx).
 * Usado como chave secundária do rate limit.
 */
export function getClientIp(): string {
  try {
    const h = headers()
    const forwarded = h.get("x-forwarded-for")
    if (forwarded) return forwarded.split(",")[0].trim()
    return h.get("x-real-ip") || "unknown"
  } catch {
    // Fora de uma request (ex.: testes)
    return "unknown"
  }
}

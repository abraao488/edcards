import { randomBytes } from "crypto"

/**
 * Alfabeto sem caracteres ambíguos (0/O, 1/I/L): o código pode ser digitado à
 * mão ou lido de um print, então confundir O com 0 vira suporte.
 */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"

export function generateReferralCode(length = 7): string {
  const bytes = randomBytes(length)
  let out = ""
  for (let i = 0; i < length; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length]
  }
  return out
}

/** Normaliza um código recebido do usuário (link/URL) para o formato canônico. */
export function normalizeReferralCode(raw: string | null | undefined): string {
  return (raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 16)
}

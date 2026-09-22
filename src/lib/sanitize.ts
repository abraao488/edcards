import sanitizeHtmlLib from "sanitize-html"

export const ALLOWED_COLORS = {
  vermelho: "#ef4444",
  azul: "#3b82f6",
  preto: "#000000",
  amarelo: "#eab308",
  verde: "#22c55e",
} as const

export type AllowedColorName = keyof typeof ALLOWED_COLORS
export type AllowedColorValue = (typeof ALLOWED_COLORS)[AllowedColorName]

export const ALLOWED_COLOR_VALUES = Object.values(ALLOWED_COLORS)

// Hex regex for validation
const HEX_COLOR_REGEX = /^#(?:[0-9a-fA-F]{3}){1,2}$/

// Converte rgb(r, g, b) ou rgba(r, g, b, a) para #hex — browsers produzem rgb via execCommand
function rgbToHex(match: string): string {
  const nums = match.replace(/rgba?\(/i, "").replace(/\)/, "").split(/[\s,]+/)
  const r = parseInt(nums[0], 10)
  const g = parseInt(nums[1], 10)
  const b = parseInt(nums[2], 10)
  if ([r, g, b].some((n) => isNaN(n) || n < 0 || n > 255)) return match
  const hex = "#" + [r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")
  return hex.toLowerCase()
}

// Normaliza cores dentro de style="..." de span — rgb→hex antes de sanitizar
function normalizeColorInStyle(html: string): string {
  return html.replace(
    /(<span[^>]*style="[^"]*?color\s*:\s*)(rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+(?:\s*,\s*[\d.]+)?\s*\))/gi,
    (_, prefix: string, colorFn: string) => prefix + rgbToHex(colorFn)
  )
}

// Regexes exatas para cada cor permitida (case-insensitive) — usado no allowedStyles do sanitize-html
const ALLOWED_COLOR_STYLE_REGEXES = ALLOWED_COLOR_VALUES.map(
  (c) => new RegExp(`^${c}$`, "i")
)

/**
 * Sanitiza HTML permitindo apenas b/strong, i/em, u, span com style color, br, p, ul, ol, li, div.
 * Cores são restritas à lista ALLOWED_COLORS (normalizadas para lowerCase).
 * Usa sanitize-html (puro CommonJS, sem jsdom) — compatível com serverless Vercel.
 */
export function sanitizeHtml(dirty: string): string {
  if (!dirty) return ""

  // Normaliza rgb(r,g,b) → hex ANTES do sanitize-html, pois browsers produzem rgb via execCommand
  const normalized = normalizeColorInStyle(dirty)

  const clean = sanitizeHtmlLib(normalized, {
    allowedTags: ["b", "strong", "i", "em", "u", "span", "br", "p", "ul", "ol", "li", "div"],
    allowedAttributes: {
      span: ["style"],
    },
    allowedStyles: {
      span: {
        // Apenas cores hex exatas da whitelist
        color: ALLOWED_COLOR_STYLE_REGEXES,
      },
    },
    // Desativa atributos globais extras
    allowedSchemes: [],
  })

  // Segunda passada: garante que qualquer style color remanescente seja apenas das 5 cores permitidas
  // (sanitize-html já filtra, mas esta camada cobre variações como rgb, nomes de cor, ou hex fora da lista)
  return clean.replace(/<span[^>]*style="([^"]*)"[^>]*>/gi, (match, styleContent: string) => {
    const colorMatch = styleContent.match(/color\s*:\s*([^;]+)/i)
    if (!colorMatch) return "<span>"
    const color = colorMatch[1].trim().toLowerCase()
    const normalized = color.toLowerCase()
    const isAllowed =
      ALLOWED_COLOR_VALUES.map((c) => c.toLowerCase()).includes(normalized) ||
      (ALLOWED_COLOR_VALUES as string[]).includes(normalized)
    if (isAllowed && HEX_COLOR_REGEX.test(normalized)) {
      return `<span style="color: ${normalized}">`
    }
    return "<span>"
  })
}

/**
 * Remove todas as tags HTML, retornando texto puro. Útil para validar vazio e para cloze.
 */
export function stripHtml(html: string): string {
  if (!html) return ""
  const withoutTags = html.replace(/<[^>]*>/g, "")
  return withoutTags
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .trim()
}

/**
 * Verifica se HTML contém texto visível (não vazio após strip)
 */
export function hasVisibleText(html: string): boolean {
  return stripHtml(html).length > 0
}

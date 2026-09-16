import DOMPurify from "isomorphic-dompurify"

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

/**
 * Sanitiza HTML permitindo apenas b/strong, i/em, u, span com style color, br, p, ul, ol, li, div.
 * Cores são restritas à lista ALLOWED_COLORS (normalizadas para lowerCase).
 */
export function sanitizeHtml(dirty: string): string {
  if (!dirty) return ""
  const clean = DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ["b", "strong", "i", "em", "u", "span", "br", "p", "ul", "ol", "li", "div"],
    ALLOWED_ATTR: ["style"],
    // Permitimos apenas style color; validação extra abaixo para restringir a 5 cores
  })

  // Segunda passada: filtrar span com cores não permitidas
  // Como DOMPurify já removeu scripts, fazemos parse simples via regex para garantir whitelist de cores
  // Substitui style="color: ..." inválido por span sem estilo
  return clean.replace(/<span[^>]*style="([^"]*)"[^>]*>/gi, (match, styleContent: string) => {
    const colorMatch = styleContent.match(/color\s*:\s*([^;]+)/i)
    if (!colorMatch) return "<span>"
    const color = colorMatch[1].trim().toLowerCase()
    // Normaliza hex 3 dígitos para 6 se necessário? Mantém como está, apenas verifica se está na lista ou é hex válido da lista
    const normalized = color.toLowerCase()
    const isAllowed = ALLOWED_COLOR_VALUES.map((c) => c.toLowerCase()).includes(normalized) || (ALLOWED_COLOR_VALUES as string[]).includes(normalized)
    if (isAllowed && HEX_COLOR_REGEX.test(normalized)) {
      return `<span style="color: ${normalized}">`
    }
    // Se cor não permitida, remove estilo
    return "<span>"
  })
}

/**
 * Remove todas as tags HTML, retornando texto puro. Útil para validar vazio e para cloze.
 */
export function stripHtml(html: string): string {
  if (!html) return ""
  // Usa DOMPurify para evitar regex frágil com comentários etc, depois strip
  const withoutTags = html.replace(/<[^>]*>/g, "")
  // Decodifica entidades básicas
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

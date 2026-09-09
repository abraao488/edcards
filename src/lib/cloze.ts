/**
 * Utilitário CLOZE para Edcards
 * Formato suportado: {{c1::texto}} , {{c2::outra}} e com hint opcional {{c1::texto::dica}}
 * - pergunta: cada {{cN::texto}} -> lacuna visual "______"
 * - gabarito: mesma frase com texto revelado em destaque
 */

export const CLOZE_REGEX = /\{\{c\d+::([^}:]+)(?:::[^}]+)?\}\}/g

export function hasCloze(text: string): boolean {
  return /\{\{c\d+::/.test(text)
}

export function extractClozeAnswers(text: string): string[] {
  const answers: string[] = []
  const re = new RegExp(CLOZE_REGEX.source, "g")
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    answers.push(m[1])
  }
  return answers
}

export function clozeToGapText(text: string, gap = "______"): string {
  return text.replace(CLOZE_REGEX, gap)
}

export interface ClozePart {
  text: string
  isGap: boolean
  answer?: string
}

export function parseCloze(text: string): ClozePart[] {
  const parts: ClozePart[] = []
  const re = new RegExp(CLOZE_REGEX.source, "g")
  let lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    if (m.index > lastIndex) {
      parts.push({ text: text.slice(lastIndex, m.index), isGap: false })
    }
    parts.push({ text: m[0], isGap: true, answer: m[1] })
    lastIndex = re.lastIndex
  }
  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex), isGap: false })
  }
  if (parts.length === 0) {
    parts.push({ text, isGap: false })
  }
  return parts
}

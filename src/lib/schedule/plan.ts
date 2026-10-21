/**
 * Política do cronograma reverso (Edital Fechado).
 *
 * Módulo PURO: sem banco, sem React, sem data do "agora". Concentra a regra de
 * distribuição dos assuntos no período de estudo e a marcação dos itens de
 * revisão. Ver `DEV/SPECS/ACTIVE.md`.
 *
 * Janela do plano: do primeiro dia (hoje) até a VÉSPERA da prova.
 * Ela é dividida em três fases:
 *
 *  1. ESTUDO            — cada assunto novo entra exatamente uma vez,
 *                         espalhado por todo o período de estudo.
 *  2. REVISÃO INTERMED.  — os dias de estudo que sobraram sem assunto novo
 *                         recebem a revisão do que já foi estudado.
 *  3. REVISÃO FINAL      — os últimos dias antes da prova revisam todos os
 *                         assuntos já estudados.
 *
 * Invariante central: NENHUM dia do plano fica vazio.
 */

/** Fase do plano em que o item cai. */
export type SchedulePhase = "STUDY" | "INTERMEDIATE_REVIEW" | "FINAL_REVIEW"

/** Natureza do item: estudo de assunto novo ou revisão de assunto já visto. */
export type ScheduleItemKind = "STUDY" | "REVIEW"

/** Item do plano (independente de banco). `dayIndex` é 0-based (0 = 1º dia). */
export interface PlanItem<T> {
  topic: T
  dayIndex: number
  phase: SchedulePhase
}

/** Arredonda para o início do dia (mesma hora do dia base). */
export function startOfDay(d: Date): Date {
  const nd = new Date(d.getTime())
  nd.setHours(0, 0, 0, 0)
  return nd
}

/** Soma dias de calendário (seguro em horário de verão). */
export function addDays(d: Date, days: number): Date {
  const nd = new Date(d.getTime())
  nd.setDate(nd.getDate() + days)
  return nd
}

/** Chave "YYYY-MM-DD" de um instante, no próprio fuso do servidor. */
export function toDateKey(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

const WEEKDAYS_PT_BR = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
]

const MONTHS_PT_BR = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
]

/**
 * Formata a chave "YYYY-MM-DD" como data de calendário.
 *
 * A chave é um dia do calendário, não um instante: `new Date("2026-10-20")`
 * seria interpretado como meia-noite UTC e, exibido em UTC-3, mostraria
 * "19 de outubro" — um dia antes do agendado. Por isso a data é montada
 * localmente (ano/mês/dia), sem conversão de fuso.
 */
export function formatDateKeyPtBr(dateKey: string): string {
  const parts = dateKey.split("-").map(Number)
  const year = parts[0] ?? 1970
  const month = parts[1] ?? 1
  const day = parts[2] ?? 1
  const date = new Date(year, month - 1, day)
  const weekday = WEEKDAYS_PT_BR[date.getDay()] ?? ""
  const monthName = MONTHS_PT_BR[date.getMonth()] ?? ""
  return `${weekday}, ${String(day).padStart(2, "0")} de ${monthName}`
}

/**
 * Monta o plano do cronograma reverso.
 *
 * @param topics     assuntos a estudar (a ordem define a ordem do estudo)
 * @param studyDays  dias da janela de ESTUDO
 * @param reviewDays dias da janela de REVISÃO FINAL (imediatamente antes da prova)
 *
 * Regras de distribuição:
 * - ESTUDO: assunto `k` (0-based) vai para o dia `floor(k * studyDays / n)`.
 *   Com assuntos >= dias, todo dia de estudo tem ao menos um assunto e a carga
 *   por dia difere em no máximo 1. Com poucos assuntos, eles ficam ESPALHADOS
 *   ao longo de todo o período (em vez de ocuparem só os primeiros dias).
 * - REVISÃO INTERMEDIÁRIA: cada dia de estudo sem assunto novo recebe a
 *   revisão do assunto já estudado mais esquecido (revisão mais antiga;
 *   desempate: o assunto mais antigo). Só se revisa o que já caiu.
 * - REVISÃO FINAL: todos os assuntos entram na cobertura final. Com
 *   assuntos >= dias de revisão, cada assunto aparece uma vez e a carga por
 *   dia difere em no máximo 1; com menos assuntos que dias, cada dia revisa
 *   um assunto em ciclo (todos são revisados ao menos uma vez).
 */
export function buildStudyPlan<T>(
  topics: readonly T[],
  studyDays: number,
  reviewDays: number
): PlanItem<T>[] {
  if (topics.length === 0) {
    throw new Error("Nenhum assunto para montar o cronograma!")
  }
  if (!Number.isInteger(studyDays) || studyDays < 1) {
    throw new Error("A janela de estudo precisa ter ao menos 1 dia!")
  }
  if (!Number.isInteger(reviewDays) || reviewDays < 1) {
    throw new Error("A revisão final precisa ter ao menos 1 dia!")
  }

  const total = topics.length
  const items: PlanItem<T>[] = []

  // ---------------------------------------------------------------- ESTUDO
  const studyDayOf = new Array<number>(total)
  for (let k = 0; k < total; k++) {
    const dayIndex = Math.floor((k * studyDays) / total)
    studyDayOf[k] = dayIndex
    items.push({ topic: topics[k]!, dayIndex, phase: "STUDY" })
  }

  // --------------------------------------------------- REVISÃO INTERMEDIÁRIA
  const hasNewTopic = new Array<boolean>(studyDays).fill(false)
  for (const dayIndex of studyDayOf) {
    hasNewTopic[dayIndex] = true
  }

  // `lastSeen` = último dia em que o assunto foi visto (estudo ou revisão).
  const lastSeen = studyDayOf.slice()
  for (let dayIndex = 0; dayIndex < studyDays; dayIndex++) {
    if (hasNewTopic[dayIndex]) continue

    let candidate = -1
    for (let k = 0; k < total; k++) {
      if (studyDayOf[k]! >= dayIndex) continue // ainda não foi estudado
      if (candidate === -1 || lastSeen[k]! < lastSeen[candidate]!) {
        candidate = k
      }
    }
    if (candidate === -1) continue

    lastSeen[candidate] = dayIndex
    items.push({
      topic: topics[candidate]!,
      dayIndex,
      phase: "INTERMEDIATE_REVIEW",
    })
  }

  // ---------------------------------------------------------- REVISÃO FINAL
  if (total >= reviewDays) {
    for (let r = 0; r < reviewDays; r++) {
      const from = Math.floor((r * total) / reviewDays)
      const to = Math.floor(((r + 1) * total) / reviewDays)
      for (let k = from; k < to; k++) {
        items.push({
          topic: topics[k]!,
          dayIndex: studyDays + r,
          phase: "FINAL_REVIEW",
        })
      }
    }
  } else {
    for (let r = 0; r < reviewDays; r++) {
      items.push({
        topic: topics[r % total]!,
        dayIndex: studyDays + r,
        phase: "FINAL_REVIEW",
      })
    }
  }

  return items.sort((a, b) => a.dayIndex - b.dayIndex)
}

/** Item persistido, com o mínimo necessário para a classificação. */
export interface ClassifiableItem {
  topicId: string | null
  scheduledFor: Date
}

export type ClassifiedItem<T extends ClassifiableItem> = T & {
  kind: ScheduleItemKind
  phase: SchedulePhase
}

/**
 * Marca cada item persistido como ESTUDO ou REVISÃO, sem coluna extra no banco.
 *
 * - A PRIMEIRA ocorrência de um assunto é o estudo dele; as seguintes são revisões.
 * - Tudo que está na janela de revisão final (a partir de
 *   `startDate + studyDays`) é REVISTAO FINAL, independente da ordem de chegada.
 *
 * @param window.startDate  primeiro dia do plano
 * @param window.studyDays  tamanho da janela de ESTUDO (a revisão final é o
 *                          restante até a data da prova)
 */
export function classifyScheduleItems<T extends ClassifiableItem>(
  items: readonly T[],
  window: { startDate: Date; studyDays: number }
): ClassifiedItem<T>[] {
  const finalReviewStart = addDays(window.startDate, window.studyDays)
  const finalReviewStartMs = finalReviewStart.getTime()

  const ordered = [...items].sort(
    (a, b) => a.scheduledFor.getTime() - b.scheduledFor.getTime()
  )

  const seenTopics = new Set<string>()
  return ordered.map((item) => {
    // Item sem assunto (topicId nulo) não é o estudo de um assunto novo.
    const isFirstOccurrence =
      item.topicId !== null && !seenTopics.has(item.topicId)
    if (item.topicId) {
      seenTopics.add(item.topicId)
    }

    const kind: ScheduleItemKind = isFirstOccurrence ? "STUDY" : "REVIEW"
    const isFinalReview = item.scheduledFor.getTime() >= finalReviewStartMs
    const phase: SchedulePhase = isFinalReview
      ? "FINAL_REVIEW"
      : kind === "REVIEW"
        ? "INTERMEDIATE_REVIEW"
        : "STUDY"

    return { ...item, kind, phase }
  })
}

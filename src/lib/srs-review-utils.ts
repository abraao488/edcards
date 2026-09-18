import type { Prisma } from "@prisma/client"

export type DifficultyStage = "EASY" | "MEDIUM" | "HARD"

export interface SRSReviewResult {
  nextReviewDate: Date
  nextCycleDay: number
  isCycleEnded: boolean
}

// Ciclos NÃO cumulativos: cada intervalo é contado a partir da data-base
// (data da 2ª resolução/classificação que criou o ciclo).
// Ex.: base 01/01 → HARD gera revisões em +1, +2, +7, +30, +60 e +90 dias.
export const CYCLES: Record<DifficultyStage, number[]> = {
  EASY: [14, 30, 60, 90],
  MEDIUM: [7, 21, 30, 60, 90],
  HARD: [1, 2, 7, 30, 60, 90],
}

export function classificationToRating(classification: DifficultyStage): number {
  return classification === "EASY" ? 5 : classification === "MEDIUM" ? 3 : 1
}

export interface ScheduledReviewPlan {
  scheduleDate: Date
  isFinal: boolean
}

export function startOfDay(d: Date): Date {
  const nd = new Date(d)
  nd.setHours(0, 0, 0, 0)
  return nd
}

export function addDays(d: Date, days: number): Date {
  const nd = new Date(d.getTime())
  nd.setDate(nd.getDate() + days)
  return nd
}

/**
 * Constrói o cronograma completo da revisão de um card a partir da data-base
 * (data da classificação). Cada revisão fica no início do dia alvo.
 * A última revisão do ciclo recebe isFinal = true.
 */
export function buildReviewSchedule(
  classification: DifficultyStage,
  baseDate: Date
): ScheduledReviewPlan[] {
  const intervals = CYCLES[classification] || CYCLES.MEDIUM
  return intervals.map((intervalDays, index) => ({
    scheduleDate: startOfDay(addDays(baseDate, intervalDays)),
    isFinal: index === intervals.length - 1,
  }))
}

export interface ActiveCycleInfo {
  id: string
  classification: DifficultyStage
  currentReview: number // 1-based: próxima revisão a fazer
  totalReviews: number
  baseDate: Date
  isFinal: boolean // currentReview === totalReviews
}

export type ReviewState =
  | "FIRST_RESOLUTION" // 1ª resolução pendente (nunca resolvido pelo menos uma vez)
  | "AGUARDANDO_AVALIACAO_24H" // 2ª resolução: aguarda classificação que cria o ciclo
  | "CICLO_ATIVO" // dentro do ciclo (não é a última)
  | "ULTIMA_REVISAO" // última revisão do ciclo (final, destacada em vermelho)
  | "CICLO_FINALIZADO" // ciclo concluído e ainda não renovado (opção de renovar)
  | "CONSULTA" // Modo Consulta: nenhuma UI de escrita/classificação

export interface ReviewStateInput {
  firstReviewAt?: Date | string | null
  activeCycle?: ActiveCycleInfo | null
  hasCompletedCycle?: boolean
}

/**
 * Deriva a máquina de estados do card de revisão. Única fonte de verdade usada
 * pela UI (SRSReviewSession) e pelos testes A–K.
 *
 * Regras:
 * - Sem firstReviewAt → FIRST_RESOLUTION (botão "Concluir 1ª Revisão").
 * - Com firstReviewAt e sem ciclo ativo → AGUARDANDO_AVALIACAO_24H (classificação Autoavaliar/IA).
 * - Com ciclo ativo → CICLO_ATIVO ou ULTIMA_REVISAO (a classificação NÃO é re-exibida).
 * - Sem ciclo ativo mas com ciclo(s) concluído(s) → CICLO_FINALIZADO (renovação).
 * - isQuizMode → CONSULTA (guarda total: nenhuma escrita).
 */
export function deriveReviewState(
  input: ReviewStateInput,
  isQuizMode?: boolean
): ReviewState {
  if (isQuizMode) return "CONSULTA"

  if (!input.firstReviewAt) return "FIRST_RESOLUTION"

  const activeCycle = input.activeCycle ?? null
  if (activeCycle) {
    return activeCycle.isFinal ? "ULTIMA_REVISAO" : "CICLO_ATIVO"
  }

  if (input.hasCompletedCycle) return "CICLO_FINALIZADO"

  return "AGUARDANDO_AVALIACAO_24H"
}

/**
 * Filtro de fila: exclui cards cujo ciclo já foi finalizado (completed-only).
 * Mantém: cards sem nenhum ciclo (1ª/2ª resolução) E cards com ciclo ativo.
 */
export function queueFilterWithoutCompletedOnly(): Prisma.ProgressCardWhereInput {
  return {
    OR: [
      { reviewCycles: { none: {} } },
      { reviewCycles: { some: { status: "ACTIVE" } } },
    ],
  }
}

/**
 * Compat: calcula intervalos sob demanda (substituído pelo cronograma persistido
 * em ScheduledReview). Mantido apenas para não quebrar imports existentes.
 */
export function calculateNextSRSReview(
  currentStep: number,
  difficulty: DifficultyStage
): SRSReviewResult {
  const cycle = CYCLES[difficulty] || CYCLES.MEDIUM
  let stepIndex = Math.max(0, currentStep)
  if (stepIndex >= cycle.length) {
    stepIndex = cycle.length - 1
  }
  const intervalDays = cycle[stepIndex]
  const isCycleEnded = stepIndex >= cycle.length - 1
  const nextStep = isCycleEnded ? stepIndex : stepIndex + 1
  const nextReviewDate = new Date()
  nextReviewDate.setDate(nextReviewDate.getDate() + intervalDays)
  return {
    nextReviewDate,
    nextCycleDay: nextStep,
    isCycleEnded,
  }
}
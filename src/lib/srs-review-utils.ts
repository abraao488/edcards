export type DifficultyStage = "EASY" | "MEDIUM" | "HARD"

export interface SRSReviewResult {
  nextReviewDate: Date
  nextCycleDay: number
  isCycleEnded: boolean
}

export const CYCLES: Record<DifficultyStage, number[]> = {
  EASY: [14, 30, 60, 90],
  MEDIUM: [7, 21, 30, 60, 90],
  HARD: [1, 2, 7, 21, 30, 60, 90],
}

/**
 * Calculates the next SRS review interval based on current review step (0-indexed)
 * and difficulty classification.
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

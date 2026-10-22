"use server"

import { organizeOverdueCards } from "@/lib/flashcards/organize-actions"

/**
 * @deprecated Use `organizeOverdueCards` (de `@/lib/flashcards/organize-actions`).
 *
 * Esta versão escrevia em `Flashcard.nextReview` — campo que a fila do SRS
 * NÃO lê (a fila lê `ProgressCard.nextReviewDate`). O efeito real era só
 * mexer nos badges de "cards devidos" enquanto a fila continuava igual, e
 * ainda truncava o conjunto em `take: 200` sem paginação.
 *
 * Agora é apenas um wrapper da mesma implementação: uma única fonte de
 * verdade, escrita no campo certo, sem tocar card com ciclo ativo.
 */
export async function redistributeOverdueCards() {
  const { count } = await organizeOverdueCards()
  return { redistributed: count }
}

export type SubscriptionStatus = "ACTIVE" | "PENDING" | "CANCELED"

export type QuestionDifficulty = "EASY" | "MEDIUM" | "HARD"

export interface FlashcardWithProgress {
  id: string
  front: string
  back: string
  easeFactor: number
  interval: number
  repetitions: number
  nextReview: Date
  lastReview: Date | null
  deck: {
    id: string
    name: string
    color: string
  }
  progress?: {
    lastRating: number | null
    totalReviews: number
  } | null
}

export interface DeckWithCount {
  id: string
  name: string
  description: string | null
  color: string
  _count: {
    cards: number
  }
}

export interface StudyStats {
  totalCards: number
  dueToday: number
  reviewedToday: number
  streak: number
}

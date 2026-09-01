"use client"

import { SRSReviewSession } from "@/components/srs-review-session"
import { FlashcardsFilter } from "@/components/flashcards-filter"
import type { SubjectWithTopicsAndCounts } from "@/lib/materias/actions"

interface FlashcardsReviewViewProps {
  initialProgressCards: Parameters<typeof SRSReviewSession>[0]["initialProgressCards"]
  userId: string
  email: string
  pomodoroMin: number
  initialQueueCount: number
  subjects: SubjectWithTopicsAndCounts[]
  initialTopicId?: string
}

export function FlashcardsReviewView({
  initialProgressCards,
  userId,
  email,
  pomodoroMin,
  initialQueueCount,
  subjects,
  initialTopicId,
}: FlashcardsReviewViewProps) {
  return (
    <div className="relative">
      <div className="flex flex-col items-center gap-3 pt-6">
        <FlashcardsFilter subjects={subjects} initialTopicId={initialTopicId} />
      </div>

      <SRSReviewSession
        initialProgressCards={initialProgressCards}
        userId={userId}
        email={email}
        pomodoroMin={pomodoroMin}
        initialQueueCount={initialQueueCount}
        isQuizMode={false}
      />
    </div>
  )
}

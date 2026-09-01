"use client"

import { useState } from "react"
import { Sparkles } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { SRSReviewSession } from "@/components/srs-review-session"
import { FlashcardsFilter } from "@/components/flashcards-filter"
import { updateQuizModePreference } from "@/lib/study-sessions/actions"
import type { SubjectWithTopicsAndCounts } from "@/lib/materias/actions"

interface FlashcardsReviewViewProps {
  initialProgressCards: Parameters<typeof SRSReviewSession>[0]["initialProgressCards"]
  userId: string
  email: string
  pomodoroMin: number
  initialQueueCount: number
  initialQuizMode: boolean
  subjects: SubjectWithTopicsAndCounts[]
  initialTopicId?: string
  forceQuizMode?: boolean
}

export function FlashcardsReviewView({
  initialProgressCards,
  userId,
  email,
  pomodoroMin,
  initialQueueCount,
  initialQuizMode,
  subjects,
  initialTopicId,
  forceQuizMode = false,
}: FlashcardsReviewViewProps) {
  const [quizMode, setQuizMode] = useState(initialQuizMode)
  const isQuizMode = forceQuizMode || quizMode

  const handleQuizModeChange = (checked: boolean) => {
    setQuizMode(checked)
    updateQuizModePreference(checked).catch((err) => {
      console.error("Erro ao salvar preferência de modo consulta:", err)
    })
  }

  return (
    <div className="relative">
      <div className="flex flex-col items-center gap-3 pt-6">
        <FlashcardsFilter subjects={subjects} initialTopicId={initialTopicId} />

        {!forceQuizMode && (
          <div className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 shadow-sm">
            <Sparkles className="h-4 w-4 text-primary" />
            <Switch
              checked={quizMode}
              onCheckedChange={handleQuizModeChange}
              aria-label="Modo Consulta"
            />
            <span className="text-sm font-medium text-foreground">
              Modo Consulta
            </span>
          </div>
        )}
      </div>

      <SRSReviewSession
        initialProgressCards={initialProgressCards}
        userId={userId}
        email={email}
        pomodoroMin={pomodoroMin}
        initialQueueCount={initialQueueCount}
        isQuizMode={isQuizMode}
      />
    </div>
  )
}
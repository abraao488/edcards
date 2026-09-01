"use client"

import React, { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Sidebar } from "@/components/sidebar"
import { PomodoroTimer } from "@/components/pomodoro-timer"
import { saveStudySession } from "@/lib/study-sessions/actions"
import {
  skipFlashcard,
  submitSRSReview,
  submitFirstReview,
  resetSRSProgressCycle,
  evaluateAnswerWithAI,
} from "@/lib/srs"
import type { DifficultyStage } from "@/lib/srs-review-utils"
import {
  Brain,
  CheckCircle2,
  ChevronRight,
  Flame,
  Play,
  RotateCcw,
  Sparkles,
  User,
  AlertTriangle,
  RefreshCw,
  Clock,
  ClipboardList,
} from "lucide-react"

interface FlashcardData {
  id: string
  currentCycleDay: number
  firstReviewAt?: Date | string | null
  isCycleEnded?: boolean
  difficultyStage?: DifficultyStage
  flashcard: {
    id: string
    front: string
    back: string
    topic: {
      id: string
      name: string
      subject: {
        id: string
        name: string
      }
    } | null
  }
}

interface SRSReviewSessionProps {
  initialProgressCards: FlashcardData[]
  userId: string
  email: string
  isQuizMode?: boolean
  hideSidebar?: boolean
  pomodoroMin?: number
  initialQueueCount?: number
}

export function SRSReviewSession({
  initialProgressCards,
  userId,
  email,
  isQuizMode = false,
  hideSidebar = false,
  pomodoroMin = 25,
  initialQueueCount,
}: SRSReviewSessionProps) {
  const router = useRouter()
  const [cards, setCards] = useState<FlashcardData[]>(initialProgressCards)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isFocused, setIsFocused] = useState(false)
  const [inputValue, setInputValue] = useState("")
  const [step, setStep] = useState<"START" | "TYPING" | "COMPARING" | "EVALUATING" | "FEEDBACK">("START")
  const [evalMode, setEvalMode] = useState<"CHOICE" | "AUTO" | "AI">("CHOICE")
  const [loading, setLoading] = useState(false)
  const [lastDifficulty, setLastDifficulty] = useState<DifficultyStage | null>(null)
  const [aiFeedback, setAiFeedback] = useState<string | null>(null)
  const [aiError, setAiError] = useState<string | null>(null)
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null)
  const [queueRemaining, setQueueRemaining] = useState<number>(initialQueueCount ?? initialProgressCards.length)

  const inputRef = useRef<HTMLInputElement>(null)
  const hasSavedRef = useRef(false)

  useEffect(() => {
    if (initialQueueCount !== undefined) setQueueRemaining(initialQueueCount)
  }, [initialQueueCount])

  const currentCard = cards[currentIndex]

  // Focus input automatically when typing step starts
  useEffect(() => {
    if (step === "TYPING" && inputRef.current) {
      inputRef.current.focus()
    }
  }, [step])

  // Key listener for COMPARING step
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (step === "COMPARING" && e.key === "Enter") {
        e.preventDefault()
        // No Modo Consulta, ignora a lógica de 1ª revisão — sempre mostra opções de avaliação
        if (!isQuizMode && !currentCard?.firstReviewAt) {
          handleConfirmFirstReview()
        }
      }
    }
    window.addEventListener("keydown", handleGlobalKeyDown)
    return () => window.removeEventListener("keydown", handleGlobalKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, inputValue, currentIndex, currentCard, isQuizMode])

  const decrementQueue = () => setQueueRemaining((prev) => Math.max(0, prev - 1))

  const recordStudyTime = async () => {
    if (hasSavedRef.current) return
    if (!sessionStartTime) return
    hasSavedRef.current = true
    const elapsedMinutes = Math.max(1, Math.round((Date.now() - sessionStartTime) / 60000))
    try {
      const subjectId = currentCard?.flashcard.topic?.subject.id || null
      const topicId = currentCard?.flashcard.topic?.id || null
      await saveStudySession(subjectId, topicId, elapsedMinutes)
    } catch (err) {
      hasSavedRef.current = false
      console.error("Erro ao salvar sessao de estudo:", err)
    }
  }

  const recordStudyTimeBeacon = () => {
    if (hasSavedRef.current) return
    if (!sessionStartTime) return
    hasSavedRef.current = true
    const elapsedMinutes = Math.max(1, Math.round((Date.now() - sessionStartTime) / 60000))
    const subjectId = currentCard?.flashcard.topic?.subject.id || null
    const topicId = currentCard?.flashcard.topic?.id || null
    const data = new URLSearchParams({
      subjectId: subjectId || "",
      topicId: topicId || "",
      minutes: String(elapsedMinutes),
    })
    navigator.sendBeacon("/api/study-sessions", data)
  }

  useEffect(() => {
    if (!sessionStartTime) return

    const handleBeforeUnload = () => {
      recordStudyTimeBeacon()
    }
    window.addEventListener("beforeunload", handleBeforeUnload)

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload)
      recordStudyTime()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionStartTime])

  const handleStart = () => {
    setIsFocused(true)
    setStep("TYPING")
    setInputValue("")
    setAiFeedback(null)
    setAiError(null)
    setEvalMode("CHOICE")
    if (!sessionStartTime) {
      setSessionStartTime(Date.now())
    }
  }

  const handleFirstEnter = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputValue.trim()) return
    setStep("COMPARING")
    setEvalMode("CHOICE")
  }

  const handleConfirmFirstReview = async () => {
    if (!currentCard || loading) return
    setLoading(true)
    setStep("EVALUATING")

    try {
      if (!isQuizMode) {
        await submitFirstReview(currentCard.id)
      }
      if (!isQuizMode) decrementQueue()
      setLastDifficulty("MEDIUM")
      setStep("FEEDBACK")
      setLoading(false)

      setTimeout(async () => {
        if (currentIndex + 1 < cards.length) {
          setCurrentIndex((prev) => prev + 1)
          setStep("TYPING")
          setInputValue("")
          setLastDifficulty(null)
          setAiFeedback(null)
          setEvalMode("CHOICE")
        } else {
          recordStudyTime()
          setCards([])
          setIsFocused(false)
          setStep("START")
          if (isQuizMode) {
            router.push("/materias")
          } else {
            router.refresh()
          }
        }
      }, 1500)
    } catch (err) {
      console.error("Erro ao registrar 1ª revisão:", err)
      setLoading(false)
    }
  }

  const handleConfirmReview = async (manualDifficulty?: DifficultyStage) => {
    if (!currentCard || loading) return
    setLoading(true)
    setAiError(null)
    setStep("EVALUATING")

    try {
      let difficulty: DifficultyStage

      if (isQuizMode) {
        if (manualDifficulty) {
          difficulty = manualDifficulty
          setAiFeedback(null)
        } else {
          let evaluation
          try {
            evaluation = await evaluateAnswerWithAI(
              currentCard.flashcard.front,
              currentCard.flashcard.back,
              inputValue,
              userId
            )
          } catch (aiErr) {
            console.error("Erro na avaliação com IA:", aiErr)
            setAiError(
              aiErr instanceof Error
                ? `Erro na avaliação com IA: ${aiErr.message}`
                : "Erro desconhecido na avaliação com IA."
            )
            setLoading(false)
            setStep("COMPARING")
            return
          }
          difficulty = evaluation.difficulty
          setAiFeedback(evaluation.feedback)
        }
      } else {
        const result = await submitSRSReview(
          currentCard.id,
          inputValue,
          userId,
          manualDifficulty
        )
        difficulty = result.difficulty
        setAiFeedback(result.feedback ?? null)
      }

      setLastDifficulty(difficulty)
      if (!isQuizMode) decrementQueue()
      setStep("FEEDBACK")
      setLoading(false)

      setTimeout(async () => {
        if (currentIndex + 1 < cards.length) {
          setCurrentIndex((prev) => prev + 1)
          setStep("TYPING")
          setInputValue("")
          setLastDifficulty(null)
          setAiFeedback(null)
          setAiError(null)
          setEvalMode("CHOICE")
        } else {
          recordStudyTime()
          setCards([])
          setIsFocused(false)
          setStep("START")
          if (isQuizMode) {
            router.push("/materias")
          } else {
            router.refresh()
          }
        }
      }, 1500)
    } catch (err) {
      console.error("Erro ao avaliar resposta:", err)
      setLoading(false)
      setLastDifficulty("MEDIUM")
      setAiFeedback(null)
      setAiError(
        err instanceof Error
          ? `Erro ao avaliar: ${err.message}`
          : "Erro desconhecido ao avaliar resposta."
      )
      setStep("FEEDBACK")
      setTimeout(async () => {
        if (currentIndex + 1 < cards.length) {
          setCurrentIndex((prev) => prev + 1)
          setStep("TYPING")
          setInputValue("")
          setLastDifficulty(null)
          setAiFeedback(null)
          setAiError(null)
          setEvalMode("CHOICE")
        } else {
          recordStudyTime()
          setCards([])
          setIsFocused(false)
          setStep("START")
          if (isQuizMode) {
            router.push("/materias")
          } else {
            router.refresh()
          }
        }
      }, 1500)
    }
  }

  const handleResetCycle = async () => {
    if (!currentCard || loading) return
    setLoading(true)
    try {
      if (!isQuizMode) {
        await resetSRSProgressCycle(currentCard.id, currentCard.difficultyStage)
      }
      setCards((prev) =>
        prev.map((c, i) =>
          i === currentIndex ? { ...c, isCycleEnded: false, currentCycleDay: 0 } : c
        )
      )
    } catch (err) {
      console.error("Erro ao reiniciar ciclo:", err)
    } finally {
      setLoading(false)
    }
  }

  const handleSkip = async () => {
    if (!currentCard || loading) return
    setLoading(true)
    try {
      if (!isQuizMode) {
        await skipFlashcard(currentCard.id)
      }
      if (!isQuizMode) decrementQueue()

      if (currentIndex + 1 < cards.length) {
        setCurrentIndex((prev) => prev + 1)
        setStep("TYPING")
        setInputValue("")
        setLastDifficulty(null)
        setAiFeedback(null)
        setEvalMode("CHOICE")
      } else {
        setCards([])
        setIsFocused(false)
        setStep("START")
        if (isQuizMode) {
          router.push("/materias")
        } else {
          router.refresh()
        }
      }
    } catch (err) {
      console.error("Erro ao pular card:", err)
    } finally {
      setLoading(false)
    }
  }

  const showSidebar = !isFocused && !hideSidebar

  // 1. Success state: no cards left
  if (cards.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        {showSidebar && <Sidebar email={email} />}
        <main className={`${showSidebar ? "pl-64" : ""} flex min-h-screen items-center justify-center p-8`}>
          <div className="relative w-full max-w-xl rounded-2xl border border-border bg-card p-10 text-center shadow-[0_0_30px_rgba(0,212,255,0.05)] overflow-hidden">
            <div className="absolute -left-20 -top-20 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
            <div className="absolute -right-20 -bottom-20 h-40 w-40 rounded-full bg-purple-500/10 blur-3xl" />

            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary shadow-[0_0_15px_rgba(0,212,255,0.1)]">
              <CheckCircle2 className="h-10 w-10 animate-pulse" />
            </div>

            <h1 className="mb-4 text-3xl font-black tracking-tighter text-foreground">
              {isQuizMode ? "Sessão concluída!" : "Tudo revisado por hoje!"}
            </h1>
            <p className="mb-8 text-muted-foreground leading-relaxed">
              {isQuizMode
                ? "Você respondeu a todos os flashcards disponíveis para este assunto no modo consulta."
                : "Você completou todos os seus flashcards agendados. Descanse um pouco ou continue estudando navegando por matérias."}
            </p>

            <button
              onClick={() => router.push(isQuizMode ? "/materias" : "/dashboard")}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground transition-all duration-300 hover:shadow-[0_0_20px_rgba(0,229,255,0.4)] hover:scale-[1.02]"
            >
              {isQuizMode ? "Voltar para Matérias" : "Voltar ao Painel"}
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </main>
      </div>
    )
  }

  // 2. Initial State: Starting card
  if (step === "START") {
    const subjectName = currentCard.flashcard.topic?.subject.name || "Sem Matéria"
    const topicName = currentCard.flashcard.topic?.name || "Sem Assunto"

    return (
      <div className="min-h-screen bg-background">
        {showSidebar && <Sidebar email={email} />}
        <main className={`${showSidebar ? "pl-64" : ""} flex min-h-screen items-center justify-center p-8`}>
          <div className="w-full max-w-2xl">
            <div className="mb-4 flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
                <Brain className="h-4 w-4 text-primary" />
                Cards Pendentes
              </span>
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-500/25 bg-cyan-500/10 px-3 py-1.5 font-mono text-xs font-bold text-cyan-400 backdrop-blur-sm shadow-[0_0_12px_rgba(0,212,255,0.12)]">
                  <ClipboardList className="h-3.5 w-3.5" />
                  {queueRemaining} na fila
                </span>
                <PomodoroTimer durationMin={pomodoroMin} mini />
                <span className="rounded-full border border-border bg-secondary px-3 py-1 font-mono text-xs font-bold text-foreground">
                  {cards.length} cards
                </span>
              </div>
            </div>

            <div className="relative rounded-2xl border border-border bg-card p-10 shadow-[0_0_25px_rgba(0,212,255,0.06)] overflow-hidden transition-all duration-300 hover:border-primary/45">
              <div className="absolute -left-10 -top-10 h-32 w-32 rounded-full bg-primary/5 blur-2xl" />

              <div className="mb-8 text-center">
                <span className="inline-block rounded-lg bg-primary/10 px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
                  {subjectName}
                </span>
                <h3 className="mt-3 text-lg font-semibold tracking-tight text-foreground">
                  {topicName}
                </h3>
              </div>

              <div className="flex flex-col items-center justify-center py-10">
                <button
                  onClick={handleStart}
                  className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_0_20px_rgba(0,229,255,0.35)] transition-all duration-300 hover:scale-110 hover:shadow-[0_0_30px_rgba(0,229,255,0.6)]"
                >
                  <Play className="ml-1 h-8 w-8 fill-current" />
                </button>
                <span className="mt-4 font-mono text-xs font-semibold uppercase tracking-[0.25em] text-foreground animate-pulse">
                  Iniciar Revisão
                </span>
              </div>
            </div>
          </div>
        </main>
      </div>
    )
  }

  // 3. Focus mode review loop
  const subjectName = currentCard.flashcard.topic?.subject.name || "Sem Matéria"
  const topicName = currentCard.flashcard.topic?.name || "Sem Assunto"
  const isFirstTimeCard = !currentCard.firstReviewAt
  const isEnded = Boolean(currentCard.isCycleEnded)
  // No Modo Consulta, ignoramos completamente a lógica de "1ª revisão" na UI
  const showFirstTimeUI = isFirstTimeCard && !isQuizMode

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex flex-col justify-center items-center p-6">
      <div className="absolute left-1/4 top-1/4 -translate-x-1/2 -translate-y-1/2 h-96 w-96 rounded-full bg-primary/5 blur-3xl pointer-events-none" />
      <div className="absolute right-1/4 bottom-1/4 translate-x-1/2 translate-y-1/2 h-96 w-96 rounded-full bg-purple-500/5 blur-3xl pointer-events-none" />

      <div className="w-full max-w-3xl flex flex-col z-10">

        {/* Header toolbar */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-primary">
              {subjectName}
            </span>
            <span className="text-sm font-medium text-muted-foreground">
              {topicName}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-500/25 bg-cyan-500/10 px-3 py-1.5 font-mono text-xs font-bold text-cyan-400 backdrop-blur-sm shadow-[0_0_12px_rgba(0,212,255,0.12)]">
              <ClipboardList className="h-3.5 w-3.5" />
              {queueRemaining} na fila
            </span>
            <PomodoroTimer durationMin={pomodoroMin} mini autoStart={true} />
            <span className="font-mono text-xs text-muted-foreground bg-secondary px-3 py-1.5 rounded-lg border border-border">
              Card {currentIndex + 1} de {cards.length}
            </span>
            <button
              onClick={handleSkip}
              disabled={loading}
              className="text-xs font-semibold text-muted-foreground hover:text-foreground hover:underline transition-colors py-1.5 px-3 rounded-lg hover:bg-secondary border border-transparent hover:border-border disabled:opacity-50"
            >
              Pular Card
            </button>
          </div>
        </div>

        {/* The active study card */}
        <div className={`relative min-h-[380px] flex flex-col justify-between rounded-2xl border ${isEnded ? "border-red-500/50 bg-red-950/20" : "border-border/80 bg-card/90"} backdrop-blur-md p-8 sm:p-10 shadow-[0_0_35px_rgba(0,212,255,0.06)] overflow-hidden transition-all duration-300`}>

          {/* Progress bar on top of the card */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-secondary">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${((currentIndex) / cards.length) * 100}%` }}
            />
          </div>

          {/* Cycle ended banner */}
          {isEnded && (
            <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-center">
              <div className="flex items-center justify-center gap-2 text-red-400 font-bold text-sm">
                <AlertTriangle className="h-4 w-4" />
                Este flashcard concluiu o ciclo de revisão.
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Todas as repetições agendadas foram concluídas.
              </p>
              <button
                onClick={handleResetCycle}
                disabled={loading}
                className="mt-3 inline-flex items-center gap-2 rounded-lg bg-red-600 hover:bg-red-500 text-white px-4 py-2 text-xs font-semibold transition-all shadow-md"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Reiniciar ciclo
              </button>
            </div>
          )}

          {/* Core Content */}
          <div className="flex-1 flex flex-col justify-center my-4">

            {/* TYPING STEP */}
            {step === "TYPING" && (
              <div className="space-y-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground">
                      Pergunta
                    </span>
                    {showFirstTimeUI && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-cyan-400">
                        <Clock className="h-3 w-3" /> 1ª resolução (24h)
                      </span>
                    )}
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-bold tracking-tight leading-snug text-foreground">
                    {currentCard.flashcard.front}
                  </h2>
                </div>

                <form onSubmit={handleFirstEnter} className="pt-4">
                  <div className="relative rounded-xl border border-border bg-secondary/35 p-1 transition-all duration-300 focus-within:border-primary/50 focus-within:shadow-[0_0_15px_rgba(0,229,255,0.08)]">
                    <input
                      ref={inputRef}
                      type="text"
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      placeholder="Escreva sua resposta por extenso..."
                      className="w-full bg-transparent px-4 py-3 text-base text-foreground placeholder-muted-foreground outline-none border-none"
                      disabled={loading}
                    />
                  </div>
                  <div className="mt-3 flex justify-between items-center text-xs text-muted-foreground px-1">
                    <span>Digite sua resposta por completo</span>
                    <span className="flex items-center gap-1">
                      Pressione <kbd className="bg-secondary px-1.5 py-0.5 rounded border border-border font-mono text-[10px] font-semibold">ENTER</kbd> para prosseguir
                    </span>
                  </div>
                </form>
              </div>
            )}

            {/* COMPARING STEP */}
            {step === "COMPARING" && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="space-y-3 border-b border-border/40 pb-4">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground">
                    Pergunta
                  </span>
                  <h2 className="text-xl font-bold tracking-tight text-foreground">
                    {currentCard.flashcard.front}
                  </h2>
                </div>

                <div className="grid gap-4 md:grid-cols-2 pt-1">
                  {/* Student Answer */}
                  <div className="rounded-xl border border-dashed border-border bg-secondary/20 p-5">
                    <span className="font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground">
                      Sua Resposta
                    </span>
                    <p className="mt-3 text-base text-foreground italic leading-relaxed">
                      &ldquo;{inputValue}&rdquo;
                    </p>
                  </div>

                  {/* Real Answer */}
                  <div className="rounded-xl border border-primary/10 bg-primary/5 p-5 shadow-[0_0_15px_rgba(0,212,255,0.02)]">
                    <span className="font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-primary flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Gabarito
                    </span>
                    <p className="mt-3 text-base text-foreground font-medium leading-relaxed">
                      {currentCard.flashcard.back}
                    </p>
                  </div>
                </div>

                {/* RESOLUTION OPTIONS FOR SUBSEQUENT REVIEWS */}
                {!showFirstTimeUI && evalMode === "CHOICE" && (
                  <div className="pt-4 border-t border-border/40 text-center space-y-3">
                    <span className="font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground block">
                      Como avaliar sua resposta?
                    </span>
                    <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
                      <button
                        onClick={() => setEvalMode("AUTO")}
                        className="flex items-center justify-center gap-2 rounded-xl border border-border bg-secondary/40 hover:bg-secondary hover:border-primary/40 px-4 py-3 text-sm font-semibold text-foreground transition-all shadow-sm"
                      >
                        <User className="h-4 w-4 text-primary" />
                        Autoavaliar
                      </button>
                      <button
                        onClick={() => {
                          setEvalMode("AI")
                          handleConfirmReview()
                        }}
                        className="flex items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/10 hover:bg-primary/20 px-4 py-3 text-sm font-semibold text-primary transition-all shadow-[0_0_15px_rgba(0,212,255,0.15)]"
                      >
                        <Sparkles className="h-4 w-4" />
                        Analisar com IA
                      </button>
                    </div>
                    {aiError && (
                      <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
                        {aiError}
                      </div>
                    )}
                  </div>
                )}

                {/* SELF EVALUATION BUTTONS (EASY, MEDIUM, HARD) */}
                {!showFirstTimeUI && evalMode === "AUTO" && (
                  <div className="pt-4 border-t border-border/40 text-center space-y-3 animate-in fade-in duration-200">
                    <span className="font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground block">
                      Selecione a dificuldade
                    </span>
                    <div className="grid grid-cols-3 gap-3 max-w-lg mx-auto">
                      <button
                        onClick={() => handleConfirmReview("EASY")}
                        disabled={loading}
                        className="flex flex-col items-center justify-center gap-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white p-3 font-bold text-sm transition-all shadow-[0_0_15px_rgba(16,185,129,0.25)] hover:scale-[1.03]"
                      >
                        <CheckCircle2 className="h-5 w-5" />
                        Fácil
                      </button>
                      <button
                        onClick={() => handleConfirmReview("MEDIUM")}
                        disabled={loading}
                        className="flex flex-col items-center justify-center gap-1 rounded-xl bg-amber-600 hover:bg-amber-500 text-white p-3 font-bold text-sm transition-all shadow-[0_0_15px_rgba(245,158,11,0.25)] hover:scale-[1.03]"
                      >
                        <Sparkles className="h-5 w-5" />
                        Médio
                      </button>
                      <button
                        onClick={() => handleConfirmReview("HARD")}
                        disabled={loading}
                        className="flex flex-col items-center justify-center gap-1 rounded-xl bg-rose-600 hover:bg-rose-500 text-white p-3 font-bold text-sm transition-all shadow-[0_0_15px_rgba(244,63,94,0.25)] hover:scale-[1.03]"
                      >
                        <RotateCcw className="h-5 w-5" />
                        Difícil
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* EVALUATING STEP (LOADING ACTION) */}
            {step === "EVALUATING" && (
              <div className="flex-1 flex flex-col items-center justify-center space-y-4 py-12">
                <div className="relative">
                  <div className="h-16 w-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                  <Sparkles className="h-6 w-6 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                </div>
                <div className="text-center">
                  <h3 className="text-lg font-bold tracking-tight text-foreground">
                    {showFirstTimeUI
                      ? "Agendando 1ª revisão..."
                      : evalMode === "AUTO"
                      ? "Registrando avaliação..."
                      : "Analisando resposta..."}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {showFirstTimeUI
                      ? "Sua 1ª revisão foi agendada para daqui a 24 horas."
                      : evalMode === "AUTO"
                      ? "Atualizando curva de retenção do SRS."
                      : "A IA do Edcards está realizando a comparação semântica."}
                  </p>
                </div>
              </div>
            )}

            {/* FEEDBACK STEP */}
            {step === "FEEDBACK" && (
              <div className="flex-1 flex flex-col items-center justify-center space-y-6 py-12 animate-in zoom-in-95 duration-200">
                {aiError && (
                  <div className="w-full max-w-md rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-center">
                    <p className="text-sm text-red-400 font-medium">{aiError}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      A avaliação foi feita por similaridade de texto como fallback.
                    </p>
                  </div>
                )}
                {showFirstTimeUI ? (
                  <div className="text-center space-y-4">
                    <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 shadow-[0_0_20px_rgba(0,212,255,0.2)]">
                      <Clock className="h-10 w-10" />
                    </div>
                    <div>
                      <span className="inline-block rounded-full bg-cyan-500/15 px-4 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-cyan-400">
                        1ª REVISÃO REGISTRADA
                      </span>
                      <h3 className="text-xl font-bold text-foreground mt-3">Agendado para 24 horas</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Card salvo para o próximo ciclo de retenção.
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    {lastDifficulty === "EASY" && (
                      <div className="text-center space-y-4">
                        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                          <CheckCircle2 className="h-10 w-10" />
                        </div>
                        <div>
                          <span className="inline-block rounded-full bg-emerald-500/15 px-4 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-400">
                            FÁCIL
                          </span>
                          <h3 className="text-xl font-bold text-foreground mt-3">Excelente trabalho!</h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            {aiFeedback ||
                              (isQuizMode
                                ? "Resposta registrada! Seu ciclo SRS permanece inalterado."
                                : "Domínio claro. Próxima revisão agendada.")}
                          </p>
                        </div>
                      </div>
                    )}

                    {lastDifficulty === "MEDIUM" && (
                      <div className="text-center space-y-4">
                        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 shadow-[0_0_20px_rgba(245,158,11,0.2)]">
                          <Sparkles className="h-10 w-10" />
                        </div>
                        <div>
                          <span className="inline-block rounded-full bg-amber-500/15 px-4 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-amber-400">
                            MÉDIO
                          </span>
                          <h3 className="text-xl font-bold text-foreground mt-3">Bom progresso!</h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            {aiFeedback ||
                              (isQuizMode
                                ? "Resposta parcialmente correta. Continue praticando!"
                                : "Acerto parcial. Vamos fixar isso no próximo ciclo.")}
                          </p>
                        </div>
                      </div>
                    )}

                    {lastDifficulty === "HARD" && (
                      <div className="text-center space-y-4">
                        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/30 shadow-[0_0_20px_rgba(244,63,94,0.2)]">
                          <RotateCcw className="h-10 w-10" />
                        </div>
                        <div>
                          <span className="inline-block rounded-full bg-rose-500/15 px-4 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-rose-400">
                            DIFÍCIL
                          </span>
                          <h3 className="text-xl font-bold text-foreground mt-3">Atenção necessária</h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            {aiFeedback ||
                              (isQuizMode
                                ? "Resposta incorreta. Revise o gabarito e tente novamente depois."
                                : "Intervalo encurtado para revisão imediata.")}
                          </p>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

          </div>

          {/* Footer of the card: Actions */}
          <div className="border-t border-border/40 pt-4 flex justify-between items-center">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Flame className="h-3.5 w-3.5 text-orange-500" />
              {isQuizMode ? "Edcards Modo Consulta (Não altera o banco)" : "Edcards Spaced Repetition Active"}
            </span>

            {step === "COMPARING" && showFirstTimeUI && (
              <button
                onClick={handleConfirmFirstReview}
                disabled={loading}
                className="flex items-center gap-1.5 rounded-xl bg-cyan-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition-all duration-300 hover:bg-cyan-400 hover:shadow-[0_0_15px_rgba(0,229,255,0.4)]"
              >
                Concluir 1ª Revisão (24h)
                <ChevronRight className="h-4 w-4" />
              </button>
            )}

            {step === "TYPING" && (
              <button
                onClick={handleFirstEnter}
                disabled={!inputValue.trim() || loading}
                className="flex items-center gap-1.5 rounded-xl bg-secondary border border-border hover:bg-secondary/80 px-5 py-2.5 text-sm font-semibold text-foreground transition-all disabled:opacity-50"
              >
                Ver Gabarito
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>

        </div>

        {/* Small Exit warning in focus mode */}
        <div className="mt-4 text-center">
          <button
            onClick={async () => {
              recordStudyTime()
              setIsFocused(false)
              setStep("START")
              if (isQuizMode) {
                router.push("/materias")
              }
            }}
            className="text-xs text-muted-foreground hover:text-foreground hover:underline transition-colors"
          >
            Sair do Modo Foco
          </button>
        </div>

      </div>
    </div>
  )
}

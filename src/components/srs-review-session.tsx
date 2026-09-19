"use client"

import React, { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Sidebar } from "@/components/sidebar"
import { PomodoroTimer } from "@/components/pomodoro-timer"
import { saveStudySession } from "@/lib/study-sessions/actions"
import {
  skipFlashcard,
  submitFirstReview,
  classifyAndCreateCycle,
  completeCycleReview,
  renewReviewCycle,
} from "@/lib/srs"
import {
  deriveReviewState,
  type ActiveCycleInfo,
  type DifficultyStage,
  type ReviewState,
} from "@/lib/srs-review-utils"
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
  PartyPopper,
} from "lucide-react"
import { hasCloze, parseCloze } from "@/lib/cloze"
import DOMPurify from "dompurify"

function stripHtmlForReview(html: string): string {
  return html.replace(/<[^>]*>/g, "")
}

function sanitizeForReview(html: string): string {
  if (typeof window === "undefined") return html
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ["b", "strong", "i", "em", "u", "span", "br", "p", "ul", "ol", "li", "div"],
    ALLOWED_ATTR: ["style"],
  })
}

function SafeHtml({ html, className }: { html: string; className?: string }) {
  const clean = sanitizeForReview(html)
  return <span className={className} style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }} dangerouslySetInnerHTML={{ __html: clean }} />
}

interface FlashcardData {
  id: string
  currentCycleDay: number
  firstReviewAt?: Date | string | null
  hasChosenEvalMode?: boolean
  isCycleEnded?: boolean
  difficultyStage?: DifficultyStage
  activeCycle?: ActiveCycleInfo | null
  hasCompletedCycle?: boolean
  flashcard: {
    id: string
    front: string
    back: string
    cardType?: string
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

function isClozeCard(front: string, cardType?: string): boolean {
  if (cardType === "CLOZE") return true
  return hasCloze(stripHtmlForReview(front))
}

function ClozeQuestionView({ text }: { text: string }) {
  const plain = stripHtmlForReview(text)
  const parts = parseCloze(plain)
  return (
    <span>
      {parts.map((p, i) =>
        p.isGap ? (
          <span
            key={i}
            className="inline-flex min-w-[72px] items-center justify-center rounded-md border-b-2 border-dashed border-primary/60 bg-primary/5 px-2 py-0.5 mx-1 font-mono text-sm font-semibold tracking-widest text-primary"
          >
            ______
          </span>
        ) : (
          <span key={i}>{p.text}</span>
        )
      )}
    </span>
  )
}

function ClozeAnswerView({ text }: { text: string }) {
  const plain = stripHtmlForReview(text)
  const parts = parseCloze(plain)
  return (
    <span>
      {parts.map((p, i) =>
        p.isGap ? (
          <span
            key={i}
            className="inline-flex items-center justify-center rounded-md border-b-2 border-primary bg-primary/15 px-2 py-0.5 mx-1 font-bold text-primary"
          >
            {p.answer}
          </span>
        ) : (
          <span key={i}>{p.text}</span>
        )
      )}
    </span>
  )
}

function AnswerComparisonView({
  inputValue,
  frontText,
  backHtml,
  isCloze,
}: {
  inputValue: string
  frontText: string
  backHtml: string
  isCloze: boolean
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 pt-1">
      {/* Sua Resposta — esquerda */}
      <div className="rounded-xl border border-dashed border-border bg-secondary/20 p-5">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground">
          Sua Resposta
        </span>
        <p className="mt-3 text-base text-foreground italic leading-relaxed whitespace-pre-wrap break-words">
          &ldquo;{inputValue}&rdquo;
        </p>
      </div>
      {/* Gabarito — direita, com ícone de check e SafeHtml/ClozeAnswerView */}
      <div className="rounded-xl border border-primary/10 bg-primary/5 p-5 shadow-[0_0_15px_rgba(0,212,255,0.02)]">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-primary flex items-center gap-1">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Gabarito
        </span>
        <p className="mt-3 text-base text-foreground font-medium leading-relaxed whitespace-pre-wrap break-words">
          {isCloze ? <ClozeAnswerView text={frontText} /> : <SafeHtml html={backHtml} />}
        </p>
        {isCloze && (
          <p className="mt-2 text-xs text-muted-foreground">
            Resposta esperada:{" "}
            <span className="font-semibold text-foreground">
              <SafeHtml html={backHtml} />
            </span>
          </p>
        )}
      </div>
    </div>
  )
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
  const [feedbackKind, setFeedbackKind] = useState<"FIRST" | "CLASSIFIED" | "CYCLE" | null>(null)
  const [lastIsCycleCompleted, setLastIsCycleCompleted] = useState(false)
  const [schedulePreview, setSchedulePreview] = useState<Date[]>([])
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null)
  const [queueRemaining, setQueueRemaining] = useState<number>(initialQueueCount ?? initialProgressCards.length)

  const inputRef = useRef<HTMLTextAreaElement>(null)
  const hasSavedRef = useRef(false)

  useEffect(() => {
    if (initialQueueCount !== undefined) setQueueRemaining(initialQueueCount)
  }, [initialQueueCount])

  const currentCard = cards[currentIndex]

  // Máquina de estados (fonte única de verdade — ver lib/srs-review-utils.ts).
  // No Modo Consulta deriva para CONSULTA e nenhuma escrita acontece.
  const state: ReviewState = deriveReviewState(
    {
      firstReviewAt: currentCard?.firstReviewAt ?? null,
      activeCycle: currentCard?.activeCycle ?? null,
      hasCompletedCycle: currentCard?.hasCompletedCycle ?? false,
    },
    isQuizMode
  )

  // A escolha do modo de avaliação (Autoavaliar / IA) só aparece na
  // classificação (2ª resolução) e na renovação do ciclo.
  const getInitialEvalMode = (card: FlashcardData | undefined): "CHOICE" | "AI" => {
    if (!card) return "CHOICE"
    return "CHOICE"
  }

  // Sincroniza evalMode quando o card atual muda ou quando entra em TYPING/COMPARING
  useEffect(() => {
    if (step === "TYPING" || step === "COMPARING") {
      setEvalMode(getInitialEvalMode(currentCard))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, cards, step])

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
        // No Modo Consulta (state = CONSULTA) nada é acionado pelo Enter:
        // a navegação é manual via "Próximo card".
        if (state === "FIRST_RESOLUTION") {
          handleConfirmFirstReview()
        } else if (state === "CICLO_ATIVO" || state === "ULTIMA_REVISAO") {
          handleConfirmReview()
        }
      }
    }
    window.addEventListener("keydown", handleGlobalKeyDown)
    return () => window.removeEventListener("keydown", handleGlobalKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, inputValue, currentIndex, currentCard, state])

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

  const resetCardFeedback = () => {
    setInputValue("")
    setLastDifficulty(null)
    setAiFeedback(null)
    setAiError(null)
    setFeedbackKind(null)
    setLastIsCycleCompleted(false)
    setSchedulePreview([])
  }

  const goToNext = () => {
    if (currentIndex + 1 < cards.length) {
      const nextCard = cards[currentIndex + 1]
      setCurrentIndex((prev) => prev + 1)
      setStep("TYPING")
      resetCardFeedback()
      setEvalMode(getInitialEvalMode(nextCard))
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
  }

  const handleStart = () => {
    setIsFocused(true)
    setStep("TYPING")
    resetCardFeedback()
    setEvalMode(getInitialEvalMode(currentCard))
    if (!sessionStartTime) {
      setSessionStartTime(Date.now())
    }
  }

  const handleFirstEnter = (e: React.SyntheticEvent) => {
    e.preventDefault()
    if (!inputValue.trim()) return
    setStep("COMPARING")
    setEvalMode(getInitialEvalMode(currentCard))
  }

  // 1ª resolução: apenas agenda a revisão de 24h. Nenhuma classificação aqui.
  const handleConfirmFirstReview = async () => {
    if (!currentCard || loading) return
    if (isQuizMode || state !== "FIRST_RESOLUTION") return
    setLoading(true)
    setStep("EVALUATING")

    try {
      await submitFirstReview(currentCard.id, userId)
      decrementQueue()
      setLastDifficulty("MEDIUM")
      setFeedbackKind("FIRST")
      setLastIsCycleCompleted(false)
      setSchedulePreview([])
      setAiFeedback(null)
      setCards((prev) =>
        prev.map((c, i) =>
          i === currentIndex ? { ...c, firstReviewAt: new Date().toISOString() } : c
        )
      )
      setStep("FEEDBACK")
      setLoading(false)
      // Avanço manual: o usuário clica em "Próximo card" no FEEDBACK
    } catch (err) {
      console.error("Erro ao registrar 1ª revisão:", err)
      setLoading(false)
    }
  }

  // Aplica localmente o resultado de uma classificação (ciclo criado / renovado)
  const applyCycleCreated = (classification: DifficultyStage, feedback: string | null, scheduleDates: Date[], totalReviews: number, cycleId: string) => {
    setLastDifficulty(classification)
    setAiFeedback(feedback)
    setSchedulePreview(scheduleDates)
    setLastIsCycleCompleted(false)
    setFeedbackKind("CLASSIFIED")
    setCards((prev) =>
      prev.map((c, i) =>
        i === currentIndex
          ? {
              ...c,
              hasChosenEvalMode: true,
              difficultyStage: classification,
              activeCycle: {
                id: cycleId,
                classification,
                currentReview: 1,
                totalReviews,
                baseDate: new Date(),
                isFinal: totalReviews <= 1,
              },
              hasCompletedCycle: false,
            }
          : c
      )
    )
  }

  // Aplica localmente o resultado de uma revisão DENTRO do ciclo ativo
  const applyCycleReviewCompleted = (classification: DifficultyStage, nextReviewDate: Date, currentReview: number, totalReviews: number, isCycleCompleted: boolean) => {
    setLastDifficulty(classification)
    setAiFeedback(null)
    setSchedulePreview([nextReviewDate])
    setLastIsCycleCompleted(isCycleCompleted)
    setFeedbackKind("CYCLE")
    setCards((prev) =>
      prev.map((c, i) =>
        i === currentIndex
          ? {
              ...c,
              activeCycle: isCycleCompleted
                ? null
                : {
                    ...(c.activeCycle as ActiveCycleInfo),
                    currentReview,
                    isFinal: false,
                  },
              hasCompletedCycle: isCycleCompleted || Boolean(c.hasCompletedCycle),
              currentCycleDay: currentReview,
            }
          : c
      )
    )
  }

  // Classificação (2ª resolução) OU renovação OU conclusão de revisão do ciclo.
  // Nenhuma agulha toca o modo consulta: se chegar aqui, state nunca é CONSULTA.
  const handleConfirmReview = async (manualDifficulty?: DifficultyStage) => {
    if (!currentCard || loading) return
    if (isQuizMode) return // consulta: use handleNextQuizCard, não chama IA nem atualiza banco
    setLoading(true)
    setAiError(null)
    setStep("EVALUATING")

    try {
      if (state === "AGUARDANDO_AVALIACAO_24H") {
        const r = await classifyAndCreateCycle(currentCard.id, inputValue, userId, manualDifficulty)
        applyCycleCreated(r.classification, r.feedback, r.scheduleDates, r.totalReviews, r.cycleId)
      } else if (state === "CICLO_FINALIZADO") {
        const r = await renewReviewCycle(currentCard.id, inputValue, userId, manualDifficulty)
        applyCycleCreated(r.classification, r.feedback, r.scheduleDates, r.totalReviews, r.cycleId)
      } else if (state === "CICLO_ATIVO" || state === "ULTIMA_REVISAO") {
        const r = await completeCycleReview(currentCard.id, inputValue, userId)
        applyCycleReviewCompleted(r.classification, r.nextReviewDate, r.currentReview, r.totalReviews, r.isCycleCompleted)
      } else {
        throw new Error("Ação de revisão indisponível para este card")
      }

      decrementQueue()
      setStep("FEEDBACK")
      setLoading(false)
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
      setFeedbackKind("CYCLE")
      setLastIsCycleCompleted(false)
      setSchedulePreview([])
      setStep("FEEDBACK")
    }
  }

  // Renovar o ciclo concluído dentro da própria sessão de revisão
  const handleStartRenewal = () => {
    if (!currentCard || loading) return
    setCards((prev) =>
      prev.map((c, i) =>
        i === currentIndex ? { ...c, activeCycle: null, hasCompletedCycle: true } : c
      )
    )
    setStep("TYPING")
    resetCardFeedback()
    setEvalMode("CHOICE")
  }

  const handleSkip = async () => {
    if (!currentCard || loading) return
    setLoading(true)
    try {
      if (!isQuizMode) {
        await skipFlashcard(currentCard.id)
      }
      if (!isQuizMode) decrementQueue()
      goToNext()
    } catch (err) {
      console.error("Erro ao pular card:", err)
    } finally {
      setLoading(false)
    }
  }

  // Modo consulta: apenas revela gabarito (currentCard.flashcard.back) para
  // autoavaliação visual — sem IA, sem difficulty, sem ProgressCard
  const handleNextQuizCard = () => {
    if (!currentCard) return
    if (!isQuizMode) return
    goToNext()
  }

  const showSidebar = !isFocused && !hideSidebar

  // 1. Success state: no cards left
  if (cards.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        {showSidebar && <Sidebar email={email} />}
        <main className={`${showSidebar ? "pt-14 lg:pl-64 lg:pt-0" : ""} flex min-h-screen items-center justify-center p-4 sm:p-6 lg:p-8`}>
          <div className="relative w-full max-w-xl rounded-2xl border border-border bg-card p-6 sm:p-10 text-center shadow-[0_0_30px_rgba(0,212,255,0.05)] animate-edcards-scale overflow-hidden">
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
              className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground transition-all duration-200 ease-out hover:bg-primary/90 hover:shadow-[0_0_20px_rgba(0,229,255,0.3)] active:scale-[0.98]"
            >
              {isQuizMode ? "Voltar para Matérias" : "Voltar ao Painel"}
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
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
        <main className={`${showSidebar ? "pt-14 lg:pl-64 lg:pt-0" : ""} flex min-h-screen items-center justify-center p-4 sm:p-6 lg:p-8`}>
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
  const isClozeCurrent = currentCard
    ? isClozeCard(currentCard.flashcard.front, currentCard.flashcard.cardType)
    : false

  const activeCycle = currentCard?.activeCycle ?? null
  const isFinalReviewState = state === "ULTIMA_REVISAO"
  const isCycleState = state === "CICLO_ATIVO" || state === "ULTIMA_REVISAO"
  // Nº da revisão que acabou de ser concluída (o local já aponta para a próxima)
  const numericCurrentReview = activeCycle ? activeCycle.currentReview - 1 : 0

  // MODE SELECTOR: qual painel de ação render no COMPARING por estado
  const isClassificationState = state === "AGUARDANDO_AVALIACAO_24H" || state === "CICLO_FINALIZADO"
  const showChoiceUI = !isQuizMode && isClassificationState && evalMode === "CHOICE"
  const showAutoButtonsUI = !isQuizMode && isClassificationState && evalMode === "AUTO"
  const showDirectConfirmUI = !isQuizMode && isCycleState

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex flex-col justify-center items-center p-4 sm:p-6">
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
        <div className={`relative min-h-[380px] flex flex-col justify-between rounded-2xl border ${isFinalReviewState ? "border-red-500/50 bg-red-950/20" : "border-border/80 bg-card/90"} backdrop-blur-md p-8 sm:p-10 shadow-[0_0_35px_rgba(0,212,255,0.06)] overflow-hidden transition-all duration-300`}>

          {/* Progress bar on top of the card */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-secondary">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${((currentIndex) / cards.length) * 100}%` }}
            />
          </div>

          {/* Última revisão do ciclo (final, em vermelho) */}
          {isFinalReviewState && (
            <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-center">
              <div className="flex items-center justify-center gap-2 text-red-400 font-bold text-sm">
                <AlertTriangle className="h-4 w-4" />
                Última revisão do ciclo
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Ao concluir, o ciclo será finalizado — depois você pode renová-lo em Matérias ou aqui.
              </p>
            </div>
          )}

          {/* Renovação do ciclo (card finalizado, reaberto via Matérias) */}
          {state === "CICLO_FINALIZADO" && (
            <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-center">
              <div className="flex items-center justify-center gap-2 text-amber-400 font-bold text-sm">
                <RefreshCw className="h-4 w-4" />
                Renovação do ciclo de revisões
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Este card concluiu todas as revisões agendadas. Responda novamente para classificar e gerar um novo ciclo.
              </p>
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
                    {state === "FIRST_RESOLUTION" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-cyan-400">
                        <Clock className="h-3 w-3" /> 1ª resolução (24h)
                      </span>
                    )}
                    {isCycleState && activeCycle && (
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider ${isFinalReviewState ? "bg-red-500/10 border border-red-500/20 text-red-400" : "bg-cyan-500/10 border border-cyan-500/20 text-cyan-400"}`}>
                        <Clock className="h-3 w-3" />
                        Revisão {activeCycle.currentReview} de {activeCycle.totalReviews}
                      </span>
                    )}
                    {state === "CICLO_FINALIZADO" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-amber-400">
                        <RefreshCw className="h-3 w-3" /> Renovação
                      </span>
                    )}
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-bold tracking-tight leading-snug text-foreground">
                    {isClozeCurrent ? (
                      <ClozeQuestionView text={currentCard.flashcard.front} />
                    ) : (
                      <SafeHtml html={currentCard.flashcard.front} className="leading-snug" />
                    )}
                  </h2>
                </div>

                <form onSubmit={handleFirstEnter} className="pt-4">
                  <div className="relative rounded-xl border border-border bg-secondary/35 p-1 transition-all duration-300 focus-within:border-primary/50 focus-within:shadow-[0_0_15px_rgba(0,229,255,0.08)]">
                    <textarea
                      ref={inputRef}
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && e.shiftKey) {
                          e.preventDefault()
                          const el = e.currentTarget
                          const start = el.selectionStart ?? inputValue.length
                          const end = el.selectionEnd ?? inputValue.length
                          const next = inputValue.slice(0, start) + "\n" + inputValue.slice(end)
                          setInputValue(next)
                          requestAnimationFrame(() => {
                            el.selectionStart = el.selectionEnd = start + 1
                          })
                        } else if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault()
                          handleFirstEnter(e)
                        }
                      }}
                      placeholder={
                        isClozeCurrent
                          ? "Digite a(s) palavra(s) omitida(s)..."
                          : "Escreva sua resposta por extenso... (Shift+Enter quebra linha)"
                      }
                      rows={3}
                      className="w-full min-h-[56px] max-h-[140px] resize-y bg-transparent px-4 py-3 text-base text-foreground placeholder-muted-foreground outline-none border-none"
                      disabled={loading}
                    />
                  </div>
                  <div className="mt-3 flex justify-between items-center text-xs text-muted-foreground px-1">
                    <span>
                      {isClozeCurrent
                        ? "Complete a(s) lacuna(s) — separe múltiplas respostas por vírgula"
                        : "Digite sua resposta por completo"}
                    </span>
                    <span className="flex items-center gap-1">
                      <kbd className="bg-secondary px-1.5 py-0.5 rounded border border-border font-mono text-[10px] font-semibold">Shift+Enter</kbd> quebra linha · <kbd className="bg-secondary px-1.5 py-0.5 rounded border border-border font-mono text-[10px] font-semibold">Enter</kbd> envia
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
                    {isClozeCurrent ? (
                      <ClozeQuestionView text={currentCard.flashcard.front} />
                    ) : (
                      <SafeHtml html={currentCard.flashcard.front} />
                    )}
                  </h2>
                </div>

                <AnswerComparisonView
                  inputValue={inputValue}
                  frontText={currentCard.flashcard.front}
                  backHtml={currentCard.flashcard.back}
                  isCloze={isClozeCurrent}
                />

                {/* Modo consulta (isQuizMode): apenas revela gabarito (currentCard.flashcard.back) para autoavaliação visual — sem IA, sem difficulty, sem ProgressCard */}
                {isQuizMode ? (
                  <div className="pt-4 border-t border-border/40 text-center space-y-3">
                    <span className="font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground block">
                      Autoavaliação visual — compare com o gabarito acima
                    </span>
                    <button
                      onClick={handleNextQuizCard}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-all duration-300 hover:shadow-[0_0_15px_rgba(0,229,255,0.3)]"
                    >
                      Próximo card
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                ) : showChoiceUI ? (
                  <div className="pt-4 border-t border-border/40 text-center space-y-3">
                    <span className="font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground block">
                      {state === "CICLO_FINALIZADO"
                        ? "Como avaliar sua resposta para o NOVO ciclo? (escolha única)"
                        : "Como avaliar sua resposta? (escolha única — 2ª revisão, cria o ciclo)"}
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
                ) : showAutoButtonsUI ? (
                  <div className="pt-4 border-t border-border/40 text-center space-y-3 animate-in fade-in duration-200">
                    <span className="font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground block">
                      Selecione a dificuldade — define o cronograma completo do ciclo
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
                ) : showDirectConfirmUI ? (
                  <div className="pt-4 border-t border-border/40 text-center space-y-3">
                    <span className="font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground block">
                      {isFinalReviewState
                        ? "Conclua a última revisão para finalizar o ciclo"
                        : "O ciclo já foi definido na classificação — basta confirmar esta revisão"}
                    </span>
                    <button
                      onClick={() => handleConfirmReview()}
                      disabled={loading}
                      className={`inline-flex items-center gap-1.5 rounded-xl px-6 py-3 text-sm font-semibold text-white transition-all duration-300 hover:shadow-[0_0_15px_rgba(0,229,255,0.3)] ${isFinalReviewState ? "bg-rose-600 hover:bg-rose-500" : "bg-primary hover:bg-primary/90"}`}
                    >
                      {isFinalReviewState ? (
                        <>
                          Concluir Última Revisão
                          <CheckCircle2 className="h-4 w-4" />
                        </>
                      ) : (
                        <>
                          {activeCycle ? `Concluir Revisão ${activeCycle.currentReview}/${activeCycle.totalReviews}` : "Concluir Revisão"}
                          <ChevronRight className="h-4 w-4" />
                        </>
                      )}
                    </button>
                    {aiError && (
                      <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
                        {aiError}
                      </div>
                    )}
                  </div>
                ) : null}
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
                    {state === "FIRST_RESOLUTION"
                      ? "Agendando 1ª revisão..."
                      : state === "CICLO_ATIVO" || state === "ULTIMA_REVISAO"
                      ? "Registrando revisão do ciclo..."
                      : state === "CICLO_FINALIZADO"
                      ? "Gerando novo ciclo..."
                      : "Analisando resposta..."}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {state === "FIRST_RESOLUTION"
                      ? "Sua 1ª revisão foi agendada para daqui a 24 horas."
                      : state === "CICLO_ATIVO" || state === "ULTIMA_REVISAO"
                      ? "Avançando no cronograma da curta/média/longa retenção."
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

                {feedbackKind === "FIRST" && (
                  <div className="w-full space-y-6 animate-in fade-in duration-300">
                    <AnswerComparisonView
                      inputValue={inputValue}
                      frontText={currentCard.flashcard.front}
                      backHtml={currentCard.flashcard.back}
                      isCloze={isClozeCurrent}
                    />
                    <div className="pt-4 border-t border-border/40 text-center space-y-3">
                      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground block">
                        Compare sua resposta com o gabarito acima
                      </span>
                      <button
                        onClick={goToNext}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-all duration-300 hover:shadow-[0_0_15px_rgba(0,229,255,0.3)]"
                      >
                        Próximo card
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}

                {feedbackKind === "CLASSIFIED" && lastDifficulty && (
                  <div className="w-full space-y-6 animate-in fade-in duration-300">
                    <AnswerComparisonView
                      inputValue={inputValue}
                      frontText={currentCard.flashcard.front}
                      backHtml={currentCard.flashcard.back}
                      isCloze={isClozeCurrent}
                    />
                    <div className="text-center space-y-4">
                      <div
                        className={`mx-auto flex h-20 w-20 items-center justify-center rounded-full border shadow-[0_0_20px_rgba(0,212,255,0.2)] ${
                          lastDifficulty === "EASY"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                            : lastDifficulty === "MEDIUM"
                            ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                            : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                        }`}
                      >
                        {lastDifficulty === "EASY" ? (
                          <CheckCircle2 className="h-10 w-10" />
                        ) : lastDifficulty === "MEDIUM" ? (
                          <Sparkles className="h-10 w-10" />
                        ) : (
                          <RotateCcw className="h-10 w-10" />
                        )}
                      </div>
                      <div>
                        <span
                          className={`inline-block rounded-full px-4 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.2em] ${
                            lastDifficulty === "EASY"
                              ? "bg-emerald-500/15 text-emerald-400"
                              : lastDifficulty === "MEDIUM"
                              ? "bg-amber-500/15 text-amber-400"
                              : "bg-rose-500/15 text-rose-400"
                          }`}
                        >
                          {lastDifficulty === "EASY" ? "FÁCIL" : lastDifficulty === "MEDIUM" ? "MÉDIO" : "DIFÍCIL"}
                        </span>
                        <h3 className="text-xl font-bold text-foreground mt-3">
                          {state === "CICLO_FINALIZADO" ? "Novo ciclo iniciado!" : "Ciclo de revisão iniciado!"}
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {aiFeedback ||
                            (lastDifficulty === "EASY"
                              ? "Domínio claro. O cronograma completo foi gerado."
                              : lastDifficulty === "MEDIUM"
                              ? "Acerto parcial. O cronograma foi ajustado à sua retenção."
                              : "Intervalo curto. Reforço garantido no início do ciclo.")}
                        </p>
                        {schedulePreview.length > 0 && (
                          <div className="mt-4">
                            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground block mb-2">
                              Próximas revisões agendadas
                            </span>
                            <div className="flex flex-wrap items-center justify-center gap-2">
                              {schedulePreview.slice(0, 6).map((d, i) => (
                                <span
                                  key={i}
                                  className={`inline-flex items-center rounded-lg border px-2.5 py-1 font-mono text-xs font-bold ${
                                    i === schedulePreview.length - 1
                                      ? "border-red-500/30 bg-red-500/10 text-red-400"
                                      : "border-primary/20 bg-primary/5 text-cyan-400"
                                  }`}
                                >
                                  {i === schedulePreview.length - 1 && <span className="mr-1 text-red-500">◉</span>}
                                  {d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        <button
                          onClick={goToNext}
                          className="mt-6 inline-flex items-center gap-1.5 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-all duration-300 hover:shadow-[0_0_15px_rgba(0,229,255,0.3)]"
                        >
                          Próximo card
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {feedbackKind === "CYCLE" && lastDifficulty && (
                  <div className="w-full space-y-6 animate-in fade-in duration-300">
                    <AnswerComparisonView
                      inputValue={inputValue}
                      frontText={currentCard.flashcard.front}
                      backHtml={currentCard.flashcard.back}
                      isCloze={isClozeCurrent}
                    />
                    <div className="text-center space-y-4">
                      <div
                        className={`mx-auto flex h-20 w-20 items-center justify-center rounded-full border shadow-[0_0_20px_rgba(0,212,255,0.2)] ${
                          lastIsCycleCompleted
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                            : "bg-cyan-500/10 text-cyan-400 border-cyan-500/30"
                        }`}
                      >
                        {lastIsCycleCompleted ? (
                          <PartyPopper className="h-10 w-10" />
                        ) : (
                          <CheckCircle2 className="h-10 w-10" />
                        )}
                      </div>
                      <div>
                        {lastIsCycleCompleted ? (
                          <>
                            <span className="inline-block rounded-full bg-emerald-500/15 px-4 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-400">
                              CICLO CONCLUÍDO
                            </span>
                            <h3 className="text-xl font-bold text-foreground mt-3">Excelente! Todas as revisões foram feitas.</h3>
                            <p className="text-sm text-muted-foreground mt-1">
                              Este card está dominado. Você pode renová-lo agora para gerar um novo ciclo.
                            </p>
                            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
                              <button
                                onClick={handleStartRenewal}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-all duration-300 hover:shadow-[0_0_15px_rgba(0,229,255,0.3)]"
                              >
                                <RefreshCw className="h-4 w-4" />
                                Renovar Ciclo
                              </button>
                              <button
                                onClick={goToNext}
                                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-secondary/60 hover:bg-secondary px-6 py-3 text-sm font-semibold text-foreground transition-all duration-200"
                              >
                                Próximo card
                                <ChevronRight className="h-4 w-4" />
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <span
                              className={`inline-block rounded-full px-4 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.2em] ${
                                lastDifficulty === "EASY"
                                  ? "bg-emerald-500/15 text-emerald-400"
                                  : lastDifficulty === "MEDIUM"
                                  ? "bg-amber-500/15 text-amber-400"
                                  : "bg-rose-500/15 text-rose-400"
                              }`}
                            >
                              {lastDifficulty === "EASY" ? "FÁCIL" : lastDifficulty === "MEDIUM" ? "MÉDIO" : "DIFÍCIL"}
                            </span>
                            <h3 className="text-xl font-bold text-foreground mt-3">
                              Revisão {numericCurrentReview} concluída!
                            </h3>
                            <p className="text-sm text-muted-foreground mt-1">
                              {schedulePreview.length > 0
                                ? `Próxima revisão agendada para ${schedulePreview[0].toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}.`
                                : "Bom trabalho — ritmo mantido dentro do cronograma."}
                            </p>
                            <button
                              onClick={goToNext}
                              className="mt-6 inline-flex items-center gap-1.5 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-all duration-300 hover:shadow-[0_0_15px_rgba(0,229,255,0.3)]"
                            >
                              Próximo card
                              <ChevronRight className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
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

            {step === "COMPARING" && state === "FIRST_RESOLUTION" && (
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
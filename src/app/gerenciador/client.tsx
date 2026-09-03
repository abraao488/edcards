"use client"

import Link from "next/link"
import { useState, useEffect, useRef, useCallback } from "react"
import { ClipboardList, X, CheckCircle2, Settings, Clock, History } from "lucide-react"
import { PomodoroTimer } from "@/components/pomodoro-timer"
import { StudyTimer } from "@/components/study-timer"
import { SaveSessionModal } from "@/components/save-session-modal"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getSubjectsWithTopics } from "@/lib/subjects/actions"
import { saveStudySession, scheduleTopicReviews } from "@/lib/study-sessions/actions"

type UpcomingCard = Awaited<
  ReturnType<typeof import("@/lib/flashcards/upcoming-actions").getUpcomingFlashcards>
>[number]

type SubjectWithTopics = Awaited<ReturnType<typeof getSubjectsWithTopics>>[number]

type HistoryItem = {
  id: string
  name: string | null
  durationMinutes: number
  createdAt: Date | string
  startedAt?: Date | string | null
  endedAt?: Date | string | null
  subject?: { name: string } | null
  topic?: { name: string } | null
}

interface GerenciadorClientProps {
  initialUpcomingCards: UpcomingCard[]
  initialHistory: HistoryItem[]
  pomodoroMin: number
  breakDuration: number
}

function formatDurationMinutes(min: number) {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h > 0 && m > 0) return `${h}h ${m}min`
  if (h > 0) return `${h}h`
  return `${m}min`
}

export function GerenciadorClient({
  initialUpcomingCards,
  initialHistory,
  pomodoroMin,
  breakDuration,
}: GerenciadorClientProps) {
  const [isBreak, setIsBreak] = useState(false)
  const [subjects, setSubjects] = useState<SubjectWithTopics[]>([])
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null)
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [isScheduling, setIsScheduling] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null)
  const hasSavedRef = useRef(false)
  const studyTimerSecondsRef = useRef(0)

  const [history, setHistory] = useState<HistoryItem[]>(initialHistory)
  const [pendingSession, setPendingSession] = useState<{
    seconds: number
    startedAt: Date
    endedAt: Date
  } | null>(null)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [activeTab, setActiveTab] = useState<"gerenciador" | "historico">("gerenciador")

  useEffect(() => {
    async function loadData() {
      const data = await getSubjectsWithTopics()
      setSubjects(data)
    }
    loadData()
  }, [])

  const topicsForSubject =
    subjects.find((s) => s.id === selectedSubjectId)?.topics || []

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }

  const requestSave = (seconds: number) => {
    if (seconds <= 0) return
    if (hasSavedRef.current) return
    const endedAt = new Date()
    const startedAt = new Date(endedAt.getTime() - seconds * 1000)
    setPendingSession({ seconds, startedAt, endedAt })
    setShowSaveModal(true)
  }

  const handleSaveStudySession = (seconds: number) => {
    requestSave(seconds)
  }

  const handlePomodoroComplete = (seconds: number) => {
    requestSave(seconds)
  }

  const handleConfirmSave = async (name: string) => {
    if (!pendingSession) return
    hasSavedRef.current = true
    setIsSaving(true)
    try {
      const minutes = Math.max(1, Math.ceil(pendingSession.seconds / 60))
      const session = await saveStudySession(
        selectedSubjectId || null,
        selectedTopicId || null,
        minutes,
        { name: name || null, startedAt: pendingSession.startedAt, endedAt: pendingSession.endedAt }
      )
      // optimistic history update
      const newItem: HistoryItem = {
        id: session.id,
        name: name?.trim() || null,
        durationMinutes: minutes,
        createdAt: session.createdAt,
        startedAt: pendingSession.startedAt,
        endedAt: pendingSession.endedAt,
        subject: selectedSubjectId ? (subjects.find(s => s.id === selectedSubjectId) as unknown as HistoryItem["subject"]) : null,
        topic: selectedTopicId ? (topicsForSubject.find(t => t.id === selectedTopicId) as unknown as HistoryItem["topic"]) : null,
      }
      setHistory((prev) => [newItem, ...prev])
      setShowSaveModal(false)
      setPendingSession(null)
      showToast("Sessão de estudo salva com sucesso!", "success")
      if (selectedTopicId) {
        setShowReviewModal(true)
      }
    } catch (err) {
      hasSavedRef.current = false
      showToast(err instanceof Error ? err.message : "Erro ao salvar sessão", "error")
    } finally {
      setIsSaving(false)
    }
  }

  const handleDiscardSave = () => {
    setShowSaveModal(false)
    setPendingSession(null)
    hasSavedRef.current = false
  }

  const recordStudyTimeBeacon = useCallback(() => {
    if (hasSavedRef.current) return
    const elapsed = studyTimerSecondsRef.current
    if (elapsed <= 0) return
    hasSavedRef.current = true
    const minutes = Math.max(1, Math.round(elapsed / 60))
    const data = new URLSearchParams({
      subjectId: selectedSubjectId || "",
      topicId: selectedTopicId || "",
      minutes: String(minutes),
    })
    navigator.sendBeacon("/api/study-sessions", data)
  }, [selectedSubjectId, selectedTopicId])

  // Não faz mais auto-save sem confirmação; apenas beacon no unload como fallback
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (!showSaveModal) recordStudyTimeBeacon()
    }
    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [recordStudyTimeBeacon, showSaveModal])

  const handleScheduleReviews = async (scheduleType: "standard" | "intensive" | "custom") => {
    if (!selectedTopicId) return
    setIsScheduling(true)
    try {
      await scheduleTopicReviews(selectedTopicId, scheduleType)
      showToast("Revisões agendadas com sucesso!", "success")
      setShowReviewModal(false)
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Erro ao agendar revisões", "error")
    } finally {
      setIsScheduling(false)
    }
  }

  return (
    <div className="relative">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex max-w-sm items-start gap-3 rounded-xl border bg-card px-4 py-3 shadow-[0_0_25px_rgba(0,212,255,0.12)] animate-in slide-in-from-bottom-4 fade-in duration-300">
          {toast.type === "success" ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
          ) : (
            <X className="mt-0.5 h-5 w-5 shrink-0 text-rose-400" />
          )}
          <p className="text-sm font-medium leading-snug text-foreground">
            {toast.message}
          </p>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="ml-auto text-muted-foreground hover:text-foreground"
            aria-label="Fechar notificação"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Save Session Modal */}
      <SaveSessionModal
        open={showSaveModal}
        durationSeconds={pendingSession?.seconds ?? 0}
        startedAt={pendingSession?.startedAt ?? null}
        endedAt={pendingSession?.endedAt ?? null}
        onSave={handleConfirmSave}
        onDiscard={handleDiscardSave}
        isSaving={isSaving}
      />

      {/* Review Modal */}
      {showReviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-[0_0_50px_rgba(0,212,255,0.15)] animate-in zoom-in-95 duration-200">
            <div className="mb-6 flex items-start justify-between">
              <div>
                <h3 className="text-xl font-bold text-foreground mb-1">
                  Deseja agendar uma revisão automática?
                </h3>
                <p className="text-sm text-muted-foreground">
                  Escolha como quer revisar este conteúdo.
                </p>
              </div>
              <button
                onClick={() => setShowReviewModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3">
              <button
                onClick={() => handleScheduleReviews("standard")}
                disabled={isScheduling}
                className="flex w-full items-center justify-between rounded-xl border border-primary/20 bg-primary/5 px-5 py-4 text-left transition-all hover:border-primary/40 hover:bg-primary/10"
              >
                <div>
                  <p className="font-semibold text-foreground">
                    Ciclo Padrão SRS
                  </p>
                  <p className="text-xs text-muted-foreground">1, 7 e 15 dias</p>
                </div>
              </button>
              <button
                onClick={() => handleScheduleReviews("intensive")}
                disabled={isScheduling}
                className="flex w-full items-center justify-between rounded-xl border border-purple-500/20 bg-purple-500/5 px-5 py-4 text-left transition-all hover:border-purple-500/40 hover:bg-purple-500/10"
              >
                <div>
                  <p className="font-semibold text-foreground">
                    Revisão Intensiva
                  </p>
                  <p className="text-xs text-muted-foreground">
                    A cada 2 dias
                  </p>
                </div>
              </button>
              <button
                onClick={() => setShowReviewModal(false)}
                disabled={isScheduling}
                className="flex w-full items-center justify-center rounded-xl px-5 py-3 text-sm font-medium text-muted-foreground transition-all hover:bg-secondary hover:text-foreground"
              >
                {isScheduling ? "Processando..." : "Agendar depois"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary shadow-[0_0_15px_rgba(0,212,255,0.12)]">
          <ClipboardList className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Gerenciador
          </h1>
          <p className="text-sm text-muted-foreground">
            Controle seu tempo e visualize sua fila de estudos.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-2 border-b border-border">
        <button
          onClick={() => setActiveTab("gerenciador")}
          className={`relative px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === "gerenciador"
              ? "text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <span className="flex items-center gap-2">
            <Clock className="h-4 w-4" /> Cronômetros
          </span>
          {activeTab === "gerenciador" && (
            <span className="absolute bottom-0 left-0 h-0.5 w-full bg-primary" />
          )}
        </button>
        <button
          onClick={() => setActiveTab("historico")}
          className={`relative px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === "historico"
              ? "text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <span className="flex items-center gap-2">
            <History className="h-4 w-4" /> Histórico{" "}
            <span className="rounded-full bg-secondary px-1.5 py-0.5 text-xs">{history.length}</span>
          </span>
          {activeTab === "historico" && (
            <span className="absolute bottom-0 left-0 h-0.5 w-full bg-primary" />
          )}
        </button>
      </div>

      {activeTab === "gerenciador" ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Column - Study Timer */}
          <div className="lg:col-span-2 space-y-6">
            {/* Subject and Topic Selectors */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="subject-select">Matéria em Estudo</Label>
                <Select
                  value={selectedSubjectId ?? ""}
                  onValueChange={(val) => {
                    setSelectedSubjectId(val)
                    setSelectedTopicId(null)
                  }}
                >
                  <SelectTrigger className="h-11 w-full border-border bg-secondary/35 px-3 text-foreground transition-all focus-visible:border-primary/50 focus-visible:ring-primary/20 hover:border-primary/30">
                    <SelectValue placeholder="Selecione uma matéria..." />
                  </SelectTrigger>
                  <SelectContent className="border-border bg-card">
                    {subjects.map((subject) => (
                      <SelectItem key={subject.id} value={subject.id}>
                        {subject.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="topic-select">Assunto em Estudo</Label>
                <Select
                  value={selectedTopicId ?? ""}
                  onValueChange={setSelectedTopicId}
                  disabled={!selectedSubjectId}
                >
                  <SelectTrigger className="h-11 w-full border-border bg-secondary/35 px-3 text-foreground transition-all focus-visible:border-primary/50 focus-visible:ring-primary/20 hover:border-primary/30">
                    <SelectValue
                      placeholder={
                        !selectedSubjectId
                          ? "Selecione uma matéria primeiro..."
                          : topicsForSubject.length === 0
                          ? "Nenhum assunto nesta matéria"
                          : "Selecione o assunto..."
                      }
                    />
                  </SelectTrigger>
                  <SelectContent className="border-border bg-card">
                    {topicsForSubject.map((topic) => (
                      <SelectItem key={topic.id} value={topic.id}>
                        {topic.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Study Timer */}
            <StudyTimer onSave={handleSaveStudySession} isSaving={isSaving} elapsedRef={studyTimerSecondsRef} onReset={() => { hasSavedRef.current = false }} />
          </div>

          {/* Sidebar Column - Pomodoro and Upcoming Cards */}
          <div className="space-y-6">
            {/* Pomodoro */}
            <div className="space-y-3">
              <div className="flex gap-2">
                <button
                  onClick={() => setIsBreak(false)}
                  className={`flex-1 py-2.5 rounded-lg border text-xs font-medium transition-all ${
                    !isBreak
                      ? "border-primary/50 bg-primary/10 text-primary shadow-[0_0_12px_rgba(0,212,255,0.15)]"
                      : "border-border text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  Foco ({pomodoroMin}m)
                </button>
                <button
                  onClick={() => setIsBreak(true)}
                  className={`flex-1 py-2.5 rounded-lg border text-xs font-medium transition-all ${
                    isBreak
                      ? "border-primary/50 bg-primary/10 text-primary shadow-[0_0_12px_rgba(0,212,255,0.15)]"
                      : "border-border text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  Pausa ({breakDuration}m)
                </button>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-foreground">
                    Pomodoro
                  </h4>
                  <Link
                    href="/dashboard/configuracoes"
                    title="Ajustar tempo do Pomodoro nas Configurações"
                    className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-primary"
                  >
                    <Settings className="h-3.5 w-3.5" />
                    <span>Ajustar</span>
                  </Link>
                </div>
                <PomodoroTimer
                  durationMin={isBreak ? breakDuration : pomodoroMin}
                  compact
                  onSaveSession={handlePomodoroComplete}
                />
                <p className="mt-3 text-center text-xs text-muted-foreground">
                  Ao completar um ciclo, você poderá nomear e salvar a sessão.
                </p>
              </div>
            </div>

            {/* Upcoming Cards */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-foreground">
                Próximos na Fila
              </h3>
              {initialUpcomingCards.length === 0 ? (
                <Card className="p-6 text-center">
                  <p className="text-muted-foreground text-sm">
                    Nenhum flashcard agendado ainda!
                  </p>
                </Card>
              ) : (
                <div className="space-y-3">
                  {initialUpcomingCards.slice(0, 3).map((card) => (
                    <Card
                      key={card.id}
                      className="p-4 border-primary/10 hover:border-primary/30 transition-all"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex flex-col">
                          <span className="text-xs text-primary font-medium uppercase tracking-wider">
                            {card.flashcard.topic?.subject?.name ||
                              card.flashcard.deck.name ||
                              "Matéria"}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {card.flashcard.topic?.name || "Assunto"}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(
                            card.nextReviewDate
                          ).toLocaleDateString("pt-BR", {
                            day: "2-digit",
                            month: "short",
                          })}
                        </span>
                      </div>
                      <p className="text-sm text-foreground truncate">
                        {card.flashcard.front}
                      </p>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <History className="h-5 w-5 text-primary" /> Histórico de Sessões
            </h2>
            <span className="text-sm text-muted-foreground">{history.length} sessões</span>
          </div>

          {history.length === 0 ? (
            <Card className="p-10 text-center border-dashed">
              <Clock className="mx-auto h-10 w-10 text-muted-foreground/50" />
              <p className="mt-3 text-sm font-medium text-foreground">Nenhuma sessão salva ainda</p>
              <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
                Inicie o cronômetro ou complete um ciclo Pomodoro e nomeie sua sessão para vê-la aqui.
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {history.map((s) => {
                const date = s.startedAt ? new Date(s.startedAt) : new Date(s.createdAt)
                const endedAt = s.endedAt ? new Date(s.endedAt) : null
                return (
                  <Card key={s.id} className="p-4 hover:border-primary/20 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {s.name?.trim() ? s.name : "Sessão sem nome"}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                            {" · "}
                            {date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                            {endedAt && ` → ${endedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`}
                          </span>
                          {s.subject?.name && (
                            <>
                              <span className="text-border">•</span>
                              <span>{s.subject.name}</span>
                              {s.topic?.name && <span>› {s.topic.name}</span>}
                            </>
                          )}
                        </div>
                      </div>
                      <span className="shrink-0 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                        {formatDurationMinutes(s.durationMinutes)}
                      </span>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

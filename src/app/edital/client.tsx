"use client"

import { useMemo, useState } from "react"
import { Lock, Calendar, RotateCcw, Flag } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  generateReverseSchedule,
  type ScheduleWithDetails,
} from "@/lib/schedule/actions"
import {
  formatDateKeyPtBr,
  type SchedulePhase,
} from "@/lib/schedule/plan"

type ScheduleResult = ScheduleWithDetails | null

const PHASE_META: Record<
  SchedulePhase,
  { label: string; badge: string; card: string; icon: typeof Calendar }
> = {
  STUDY: {
    label: "Estudo",
    badge: "bg-primary/10 text-primary border-primary/20",
    card: "border-primary/10",
    icon: Calendar,
  },
  INTERMEDIATE_REVIEW: {
    label: "Revisão",
    badge: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    card: "border-amber-500/15",
    icon: RotateCcw,
  },
  FINAL_REVIEW: {
    label: "Revisão final",
    badge: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    card: "border-emerald-500/20",
    icon: Flag,
  },
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

export function EditalClient({
  initialSchedule = null,
}: {
  /** Cronograma já gerado (ex.: persistido no banco) para renderizar na entrada. */
  initialSchedule?: ScheduleResult
}) {
  const [examDate, setExamDate] = useState("")
  const [reviewDays, setReviewDays] = useState(7)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [scheduleResult, setScheduleResult] = useState<ScheduleResult>(initialSchedule)

  async function handleGenerate() {
    if (!examDate) {
      setError("Por favor, informe a data da prova!")
      return
    }
    setLoading(true)
    setError("")
    try {
      const result = await generateReverseSchedule(
        new Date(examDate),
        reviewDays
      )
      setScheduleResult(result)
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError("Ocorreu um erro ao gerar o cronograma!")
      }
    } finally {
      setLoading(false)
    }
  }

  const days = useMemo(() => {
    if (!scheduleResult) return []
    return Object.entries(scheduleResult.groupedByDay).sort(([a], [b]) =>
      a.localeCompare(b)
    )
  }, [scheduleResult])

  const summary = useMemo(() => {
    if (!scheduleResult) return null
    const studyDays = scheduleResult.totalDays
    const totalDays = Math.round(
      (scheduleResult.examDate.getTime() - scheduleResult.startDate.getTime()) /
        (1000 * 60 * 60 * 24)
    )
    const finalReviewDays = Math.max(0, totalDays - studyDays)
    const intermediateReviewDays = Object.values(scheduleResult.groupedByDay).filter(
      (items) => items[0]?.phase === "INTERMEDIATE_REVIEW"
    ).length
    return { studyDays, finalReviewDays, totalDays, intermediateReviewDays }
  }, [scheduleResult])

  return (
    <div className="relative">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary shadow-[0_0_15px_rgba(0,212,255,0.12)]">
          <Lock className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Edital Fechado
          </h1>
          <p className="text-sm text-muted-foreground">
            Planeje seu cronograma reverso para fechar o edital!
          </p>
        </div>
      </div>

      {scheduleResult && summary ? (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-lg text-foreground">Cronograma do Edital</p>
            <Button
              variant="ghost"
              onClick={() => setScheduleResult(null)}
            >
              Criar Novo Cronograma
            </Button>
          </div>

          <Card className="border-primary/10">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className={PHASE_META.STUDY.badge}>
                  <Calendar className="h-3 w-3" />
                  {summary.studyDays} dias de estudo
                </Badge>
                <Badge
                  variant="outline"
                  className={PHASE_META.INTERMEDIATE_REVIEW.badge}
                >
                  <RotateCcw className="h-3 w-3" />
                  {summary.intermediateReviewDays} dias de revisão
                </Badge>
                <Badge variant="outline" className={PHASE_META.FINAL_REVIEW.badge}>
                  <Flag className="h-3 w-3" />
                  {summary.finalReviewDays} dias de revisão final
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {scheduleResult.totalItems} itens · prova em{" "}
                {formatDate(scheduleResult.examDate)} · criado em{" "}
                {formatDate(scheduleResult.createdAt)}
              </p>
            </div>
          </Card>

          <div className="space-y-4">
            {days.map(([dateKey, items]) => {
              const phase = items[0]?.phase ?? "STUDY"
              const meta = PHASE_META[phase]
              const PhaseIcon = meta.icon
              return (
                <Card key={dateKey} className={meta.card}>
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <PhaseIcon className="h-4 w-4 text-primary" />
                      <h3 className="font-semibold text-foreground">
                        {formatDateKeyPtBr(dateKey)}
                      </h3>
                    </div>
                    <Badge variant="outline" className={meta.badge}>
                      {meta.label}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-lg border border-border bg-secondary/30 p-3"
                      >
                        <p className="mb-1 text-xs uppercase tracking-wider text-primary">
                          {item.subject?.name || "Matéria"}
                        </p>
                        <p className="text-sm text-foreground">
                          {item.topic?.name || "Assunto"}
                        </p>
                        {item.kind === "REVIEW" && (
                          <p className="mt-1 flex items-center gap-1 text-xs text-amber-500">
                            <RotateCcw className="h-3 w-3" />
                            Revisão
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="mx-auto max-w-2xl">
          <Card className="border-primary/10 p-6">
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">
                  Data Limite da Prova
                </label>
                <input
                  type="date"
                  value={examDate}
                  onChange={(e) => setExamDate(e.target.value)}
                  className="w-full rounded-lg border border-border bg-secondary px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">
                  Dias para Revisão Final
                </label>
                <input
                  type="number"
                  value={reviewDays}
                  onChange={(e) => setReviewDays(Number(e.target.value))}
                  min={1}
                  max={365}
                  className="w-full rounded-lg border border-border bg-secondary px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Esses são os dias antes da prova dedicados à revisão de todo o
                  edital. O restante do período fica com o estudo e revisões
                  intermediárias.
                </p>
              </div>

              {error && (
                <p className="text-sm text-red-400">{error}</p>
              )}

              <Button
                onClick={handleGenerate}
                disabled={!examDate || loading}
                className="w-full py-3 text-lg"
              >
                {loading
                  ? "Gerando Cronograma..."
                  : "Gerar Cronograma Reverso"}
              </Button>
            </div>
          </Card>
        </div>
      )}

      <Dialog open={!!error} onOpenChange={() => setError("")}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Erro ao Gerar Cronograma</DialogTitle>
            <DialogDescription>{error}</DialogDescription>
          </DialogHeader>
          <Button onClick={() => setError("")}>
            Entendido
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  )
}

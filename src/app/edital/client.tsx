"use client"

import { useState } from "react"
import { Lock, Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
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

type ScheduleResult = ScheduleWithDetails | null


export function EditalClient() {
  const [examDate, setExamDate] = useState("")
  const [reviewDays, setReviewDays] = useState(7)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [scheduleResult, setScheduleResult] = useState<ScheduleResult>(null)

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

      {scheduleResult ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <p className="text-lg text-foreground">
              Cronograma Gerado com Sucesso!
            </p>
            <Button
              variant="ghost"
              onClick={() => setScheduleResult(null)}
            >
              Criar Novo Cronograma
            </Button>
          </div>
          <div className="space-y-4">
            {Object.entries(scheduleResult.groupedByDay).map(
              ([dateKey, items]) => (
                <Card key={dateKey} className="p-4 border-primary/10">
                  <div className="flex items-center gap-2 mb-3">
                    <Calendar className="h-4 w-4 text-primary" />
                    <h3 className="font-semibold text-foreground">
                      {new Date(dateKey).toLocaleDateString("pt-BR", {
                        weekday: "long",
                        day: "2-digit",
                        month: "long",
                      })}
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className="p-3 rounded-lg bg-secondary/30 border border-border"
                      >
                        <p className="text-xs text-primary uppercase tracking-wider mb-1">
                          {item.subject?.name || "Matéria"}
                        </p>
                        <p className="text-sm text-foreground">
                          {item.topic?.name || "Assunto"}
                        </p>
                      </div>
                    ))}
                  </div>
                </Card>
              )
            )}
          </div>
        </div>
      ) : (
        <div className="max-w-2xl mx-auto">
          <Card className="p-6 border-primary/10">
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
              </div>

              {error && (
                <p className="text-red-400 text-sm">{error}</p>
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

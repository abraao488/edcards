"use client"

import { useState } from "react"
import { Calendar, Plus, CheckCircle } from "lucide-react"
import {
  generateReverseSchedule,
} from "@/lib/schedule/actions"

export function ReverseSchedule() {
  const [examDate, setExamDate] = useState("")
  const [reviewDays, setReviewDays] = useState(30)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{
    scheduleId: string
    totalItems: number
  } | null>(null)

  async function handleGenerate() {
    if (!examDate) return
    setLoading(true)
    try {
      const res = await generateReverseSchedule(new Date(examDate), reviewDays)
      setResult(res)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (result) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-3">
          <CheckCircle className="h-8 w-8 text-green-400" />
          <div>
            <h3 className="font-semibold text-foreground">
              Cronograma gerado!
            </h3>
            <p className="text-sm text-muted-foreground">
              {result.totalItems} itens foram distribuídos até a data da prova.
            </p>
          </div>
        </div>
        <button
          onClick={() => setResult(null)}
          className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Fechar
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="mb-4 flex items-center gap-2">
        <Calendar className="h-5 w-5 text-primary" />
        <h3 className="font-semibold text-foreground">Edital Fechado</h3>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        Defina a data da prova e a quantidade de dias para revisão. O sistema
        distribuirá todos os assuntos uniformemente.
      </p>

      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-foreground">
            Data da Prova
          </label>
          <input
            type="date"
            value={examDate}
            onChange={(e) => setExamDate(e.target.value)}
            className="w-full rounded-lg border border-border bg-secondary px-4 py-2 text-foreground"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-foreground">
            Dias para Revisão
          </label>
          <input
            type="number"
            value={reviewDays}
            onChange={(e) => setReviewDays(Number(e.target.value))}
            min={1}
            max={365}
            className="w-full rounded-lg border border-border bg-secondary px-4 py-2 text-foreground"
          />
        </div>

        <button
          onClick={handleGenerate}
          disabled={!examDate || loading}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          {loading ? "Gerando..." : "Gerar Cronograma"}
        </button>
      </div>
    </div>
  )
}

"use client"

import { useState } from "react"
import { Shuffle, AlertTriangle, CheckCircle } from "lucide-react"
import { redistributeOverdueCards } from "@/lib/flashcards/organize"

export function OrganizeButton() {
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ count: number } | null>(null)

  async function handleOrganize() {
    setLoading(true)
    try {
      const res = await redistributeOverdueCards()
      setResult({ count: res.redistributed })
      setShowConfirm(false)
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
              Cards redistribuídos!
            </h3>
            <p className="text-sm text-muted-foreground">
              {result.count} flashcards foram reorganizados no calendário.
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

  if (showConfirm) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="mb-4 flex items-center gap-3">
          <AlertTriangle className="h-6 w-6 text-yellow-400" />
          <h3 className="font-semibold text-foreground">
            Redistribuir cards atrasados?
          </h3>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          Todos os flashcards acumulados serão redistribuídos a partir de hoje,
          priorizando os cards com mais histórico de dificuldade.
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => setShowConfirm(false)}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-secondary"
          >
            Cancelar
          </button>
          <button
            onClick={handleOrganize}
            disabled={loading}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? "Redistribuindo..." : "Confirmar"}
          </button>
        </div>
      </div>
    )
  }

  return (
    <button
      onClick={() => setShowConfirm(true)}
      className="flex items-center gap-2 rounded-xl border border-border bg-card p-6 text-left transition-colors hover:bg-secondary"
    >
      <Shuffle className="h-8 w-8 text-primary" />
      <div>
        <h3 className="font-semibold text-foreground">Organizar</h3>
        <p className="text-sm text-muted-foreground">
          Redistribuir flashcards atrasados
        </p>
      </div>
    </button>
  )
}

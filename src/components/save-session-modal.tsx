"use client"

import { useState, useEffect } from "react"
import { X, Clock, Save } from "lucide-react"

interface SaveSessionModalProps {
  open: boolean
  durationSeconds: number
  startedAt: Date | null
  endedAt: Date | null
  onSave: (name: string) => void
  onDiscard: () => void
  isSaving?: boolean
}

function formatDuration(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  if (h > 0) return `${h}h ${m}min ${s}s`
  if (m > 0) return `${m}min ${s}s`
  return `${s}s`
}

export function SaveSessionModal({
  open,
  durationSeconds,
  startedAt,
  endedAt,
  onSave,
  onDiscard,
  isSaving,
}: SaveSessionModalProps) {
  const [name, setName] = useState("")

  useEffect(() => {
    if (open) setName("")
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-[0_0_50px_rgba(0,212,255,0.15)] animate-in zoom-in-95 duration-200">
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold text-foreground">Nomear sessão de estudo</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Dê um nome para esta sessão antes de salvar no histórico.
            </p>
          </div>
          <button
            onClick={onDiscard}
            className="rounded-lg p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-4 flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5 text-sm">
          <Clock className="h-4 w-4 text-primary" />
          <span className="font-medium text-foreground">{formatDuration(durationSeconds)}</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-xs text-muted-foreground">
            {startedAt ? startedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "--:--"}
            {" → "}
            {endedAt ? endedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "--:--"}
          </span>
        </div>

        <label className="mb-1.5 block text-sm font-medium text-foreground" htmlFor="session-name">
          Nome da sessão
        </label>
        <input
          id="session-name"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex: Revisão Direito Constitucional"
          className="w-full rounded-xl border border-border bg-secondary/40 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
          onKeyDown={(e) => {
            if (e.key === "Enter") onSave(name)
            if (e.key === "Escape") onDiscard()
          }}
        />

        <div className="mt-6 flex gap-3">
          <button
            onClick={onDiscard}
            disabled={!!isSaving}
            className="flex-1 rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm font-medium text-foreground hover:bg-secondary/80 disabled:opacity-50"
          >
            Descartar
          </button>
          <button
            onClick={() => onSave(name)}
            disabled={!!isSaving}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" /> Salvar
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

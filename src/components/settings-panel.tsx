"use client"

import { useState } from "react"
import { Brain, Timer, Target, Coffee } from "lucide-react"
import {
  updateAISetting,
  updatePomodoroSetting,
  updateBreakSetting,
  updateConcurrence,
} from "@/lib/settings/actions"

interface SettingsPanelProps {
  aiEnabled: boolean
  pomodoroMin: number
  breakDuration: number
  concurrenceName: string
}

export function SettingsPanel({
  aiEnabled,
  pomodoroMin,
  breakDuration,
  concurrenceName,
}: SettingsPanelProps) {
  const [ai, setAi] = useState(aiEnabled)
  const [pomodoro, setPomodoro] = useState(pomodoroMin)
  const [breakDur, setBreakDur] = useState(breakDuration)
  const [concurrence, setConcurrence] = useState(concurrenceName)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savingAI, setSavingAI] = useState(false)
  const [savingPomodoro, setSavingPomodoro] = useState(false)
  const [savingBreak, setSavingBreak] = useState(false)

  function showSavedFeedback() {
    setSaved(true)
    setError(null)
    setTimeout(() => setSaved(false), 2000)
  }

  function showErrorResponse(err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro ao salvar configuração."
    setError(msg)
    console.error("Erro ao salvar configuração:", err)
    setTimeout(() => setError(null), 5000)
  }

  async function handleSaveAI(value: boolean) {
    setSavingAI(true)
    setError(null)
    try {
      setAi(value)
      await updateAISetting(value)
      showSavedFeedback()
    } catch (err) {
      setAi(!value)
      showErrorResponse(err)
    } finally {
      setSavingAI(false)
    }
  }

  async function handleSavePomodoro(value: number) {
    setSavingPomodoro(true)
    setError(null)
    try {
      setPomodoro(value)
      await updatePomodoroSetting(value)
      showSavedFeedback()
    } catch (err) {
      setPomodoro(pomodoroMin)
      showErrorResponse(err)
    } finally {
      setSavingPomodoro(false)
    }
  }

  async function handleSaveBreak(value: number) {
    setSavingBreak(true)
    setError(null)
    try {
      setBreakDur(value)
      await updateBreakSetting(value)
      showSavedFeedback()
    } catch (err) {
      setBreakDur(breakDuration)
      showErrorResponse(err)
    } finally {
      setSavingBreak(false)
    }
  }

  async function handleSaveConcurrence() {
    setError(null)
    try {
      await updateConcurrence(concurrence)
      showSavedFeedback()
    } catch (err) {
      showErrorResponse(err)
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-border bg-card p-6">
        <div className="mb-4 flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-foreground">Avaliação por IA</h3>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          Quando ativado, a IA classifica automaticamente a dificuldade dos seus
          cards. Quando desativado, a classificação é feita por similaridade de
          texto.
        </p>
        <button
          onClick={() => handleSaveAI(!ai)}
          disabled={savingAI}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            ai ? "bg-primary" : "bg-secondary"
          } disabled:opacity-50`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              ai ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
        <span className="ml-3 text-sm text-muted-foreground">
          {ai ? "Ativado" : "Desativado"}
        </span>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <div className="mb-4 flex items-center gap-2">
          <Timer className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-foreground">Pomodoro</h3>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          Defina a duração padrão do cronômetro de estudo.
        </p>
        <div className="flex items-center gap-3">
          <input
            type="number"
            value={pomodoro}
            onChange={(e) => setPomodoro(Number(e.target.value))}
            min={5}
            max={120}
            className="w-20 rounded-lg border border-border bg-secondary px-3 py-2 text-foreground"
          />
          <span className="text-sm text-muted-foreground">minutos</span>
          <button
            onClick={() => handleSavePomodoro(pomodoro)}
            disabled={savingPomodoro}
            className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {savingPomodoro ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <div className="mb-4 flex items-center gap-2">
          <Coffee className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-foreground">Pausa</h3>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          Defina a duração padrão da pausa entre ciclos de estudo.
        </p>
        <div className="flex items-center gap-3">
          <input
            type="number"
            value={breakDur}
            onChange={(e) => setBreakDur(Number(e.target.value))}
            min={1}
            max={60}
            className="w-20 rounded-lg border border-border bg-secondary px-3 py-2 text-foreground"
          />
          <span className="text-sm text-muted-foreground">minutos</span>
          <button
            onClick={() => handleSaveBreak(breakDur)}
            disabled={savingBreak}
            className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {savingBreak ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <div className="mb-4 flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-foreground">Concurso de Interesse</h3>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          Defina o concurso que está estudando. Aparecerá no Dashboard.
        </p>
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={concurrence}
            onChange={(e) => setConcurrence(e.target.value)}
            placeholder="Ex: Polícia Militar do Alagoas"
            className="flex-1 rounded-lg border border-border bg-secondary px-3 py-2 text-foreground placeholder:text-muted-foreground"
          />
          <button
            onClick={handleSaveConcurrence}
            className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            {saved ? "Salvo!" : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  )
}

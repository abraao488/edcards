"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Play, Pause, RotateCw, Timer } from "lucide-react"

interface PomodoroTimerProps {
  durationMin?: number
  compact?: boolean
  mini?: boolean
  autoStart?: boolean
  onTick?: (secondsRemaining: number) => void
  onSaveSession?: (elapsedSeconds: number) => void
}

export function PomodoroTimer({
  durationMin = 25,
  compact = false,
  mini = false,
  autoStart = false,
  onTick,
  onSaveSession,
}: PomodoroTimerProps) {
  const [timeLeft, setTimeLeft] = useState(durationMin * 60)
  const [isRunning, setIsRunning] = useState(autoStart)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const timeLeftRef = useRef(timeLeft)
  const onTickRef = useRef(onTick)
  const hasSavedRef = useRef(false)
  const sessionStartTimeRef = useRef<number | null>(null)

  useEffect(() => {
    timeLeftRef.current = timeLeft
  }, [timeLeft])

  useEffect(() => {
    onTickRef.current = onTick
  }, [onTick])

  const getElapsedSeconds = useCallback(
    () => durationMin * 60 - timeLeftRef.current,
    [durationMin]
  )

  const recordStudyTimeBeacon = useCallback(() => {
    if (hasSavedRef.current) return
    if (!sessionStartTimeRef.current) return
    const elapsed = getElapsedSeconds()
    if (elapsed <= 0) return
    hasSavedRef.current = true
    const minutes = Math.max(1, Math.round(elapsed / 60))
    const data = new URLSearchParams({
      subjectId: "",
      topicId: "",
      minutes: String(minutes),
    })
    navigator.sendBeacon("/api/study-sessions", data)
  }, [getElapsedSeconds])

  const recordStudyTime = useCallback(() => {
    if (hasSavedRef.current) return
    if (!sessionStartTimeRef.current) return
    const elapsed = getElapsedSeconds()
    if (elapsed <= 0) return
    hasSavedRef.current = true
    if (onSaveSession) onSaveSession(elapsed)
  }, [getElapsedSeconds, onSaveSession])

  useEffect(() => {
    if (!isRunning || !sessionStartTimeRef.current) return

    const handleBeforeUnload = () => {
      recordStudyTimeBeacon()
    }
    window.addEventListener("beforeunload", handleBeforeUnload)

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload)
      recordStudyTime()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning, sessionStartTimeRef.current])

  useEffect(() => {
    if (!isRunning) {
      if (intervalRef.current) clearInterval(intervalRef.current)
      return
    }
    if (!sessionStartTimeRef.current) {
      sessionStartTimeRef.current = Date.now()
    }
    intervalRef.current = setInterval(() => {
      const next = timeLeftRef.current - 1
      if (next <= 0) {
        if (intervalRef.current) clearInterval(intervalRef.current)
        setIsRunning(false)
        setTimeLeft(0)
        if (onTickRef.current) onTickRef.current(0)
        recordStudyTime()
        return
      }
      setTimeLeft(next)
      if (onTickRef.current) onTickRef.current(next)
    }, 1000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [isRunning, recordStudyTime])

  useEffect(() => {
    setTimeLeft(durationMin * 60)
    if (autoStart) {
      setIsRunning(true)
    }
  }, [durationMin, autoStart])

  function toggle() {
    setIsRunning(!isRunning)
  }

  function reset() {
    setIsRunning(false)
    setTimeLeft(durationMin * 60)
    if (onTick) onTick(durationMin * 60)
    hasSavedRef.current = false
    sessionStartTimeRef.current = null
  }

  const minutes = Math.floor(timeLeft / 60)
  const seconds = timeLeft % 60
  const progress = ((durationMin * 60 - timeLeft) / (durationMin * 60)) * 100

  if (mini) {
    return (
      <div className="inline-flex items-center gap-2 rounded-xl border border-primary/25 bg-secondary/80 px-3 py-1.5 backdrop-blur-sm shadow-[0_0_15px_rgba(0,212,255,0.08)]">
        <Timer className="h-4 w-4 text-primary animate-pulse" />
        <span className="font-mono text-xs font-bold text-foreground">
          {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
        </span>
        <button
          onClick={toggle}
          title={isRunning ? "Pausar Pomodoro" : "Iniciar Pomodoro"}
          className="rounded-md bg-primary/20 p-1 text-primary hover:bg-primary/30 transition-colors"
        >
          {isRunning ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
        </button>
        <button
          onClick={reset}
          title="Reiniciar Pomodoro"
          className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
        >
          <RotateCw className="h-3 w-3" />
        </button>
      </div>
    )
  }

  if (compact) {
    return (
      <div>
        <div className="relative mb-4 flex justify-center">
          <svg className="h-28 w-28 -rotate-90">
            <circle
              cx="56"
              cy="56"
              r="48"
              fill="none"
              stroke="currentColor"
              strokeWidth="6"
              className="text-secondary/50"
            />
            <circle
              cx="56"
              cy="56"
              r="48"
              fill="none"
              stroke="currentColor"
              strokeWidth="6"
              className="text-primary"
              strokeDasharray={`${2 * Math.PI * 48}`}
              strokeDashoffset={`${2 * Math.PI * 48 * (1 - progress / 100)}`}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-2xl font-bold text-foreground">
              {String(minutes).padStart(2, "0")}:
              {String(seconds).padStart(2, "0")}
            </span>
          </div>
        </div>
        <div className="flex justify-center gap-2">
          <button
            onClick={toggle}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-all hover:bg-primary/90"
          >
            {isRunning ? (
              <>
                <Pause className="h-3.5 w-3.5" /> Pausar
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5" /> Iniciar
              </>
            )}
          </button>
          <button
            onClick={reset}
            className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-all hover:bg-secondary hover:text-foreground"
          >
            <RotateCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-[0_0_20px_rgba(0,212,255,0.05)]">
      <h3 className="mb-4 text-lg font-semibold text-foreground">
        Cronômetro de Estudo
      </h3>

      <div className="relative mb-6 flex justify-center">
        <svg className="h-40 w-40 -rotate-90">
          <circle
            cx="80"
            cy="80"
            r="70"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className="text-secondary"
          />
          <circle
            cx="80"
            cy="80"
            r="70"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className="text-primary"
            strokeDasharray={`${2 * Math.PI * 70}`}
            strokeDashoffset={`${2 * Math.PI * 70 * (1 - progress / 100)}`}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-4xl font-bold text-foreground">
            {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
          </span>
        </div>
      </div>

      <div className="flex justify-center gap-3">
        <button
          onClick={toggle}
          className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          {isRunning ? (
            <>
              <Pause className="h-4 w-4" /> Pausar
            </>
          ) : (
            <>
              <Play className="h-4 w-4" /> Iniciar
            </>
          )}
        </button>
        <button
          onClick={reset}
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <RotateCw className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

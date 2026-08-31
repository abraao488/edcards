"use client";

import { useState, useEffect, useRef } from "react";
import { Play, Pause, RotateCw, Save } from "lucide-react";

interface StudyTimerProps {
  onSave: (seconds: number) => void;
  isSaving?: boolean;
}

export function StudyTimer({ onSave, isSaving }: StudyTimerProps) {
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeElapsedRef = useRef(timeElapsed);

  useEffect(() => {
    timeElapsedRef.current = timeElapsed;
  }, [timeElapsed]);

  useEffect(() => {
    if (!isRunning) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setTimeElapsed(timeElapsedRef.current + 1);
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning]);

  function toggle() {
    setIsRunning(!isRunning);
  }

  function reset() {
    setIsRunning(false);
    setTimeElapsed(0);
  }

  function handleSave() {
    setIsRunning(false);
    onSave(timeElapsed);
  }

  const hours = Math.floor(timeElapsed / 3600);
  const minutes = Math.floor((timeElapsed % 3600) / 60);
  const seconds = timeElapsed % 60;

  return (
    <div className="rounded-2xl border border-border bg-card p-8 shadow-[0_0_30px_rgba(0,212,255,0.08)]">
      <h3 className="mb-6 text-xl font-bold text-foreground">
        Cronômetro de Estudo
      </h3>

      <div className="relative mb-8 flex justify-center">
        <svg className="h-48 w-48 -rotate-90">
          <circle
            cx="96"
            cy="96"
            r="84"
            fill="none"
            stroke="currentColor"
            strokeWidth="10"
            className="text-secondary/50"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-5xl font-bold tracking-tight text-foreground">
            {String(hours).padStart(2, "0")}:
            {String(minutes).padStart(2, "0")}:
            {String(seconds).padStart(2, "0")}
          </span>
          <span className="mt-2 text-xs uppercase tracking-widest text-muted-foreground">
            Horas Estudadas
          </span>
        </div>
      </div>

      <div className="flex justify-center gap-3">
        <button
          onClick={toggle}
          className="flex items-center gap-2 rounded-xl bg-primary px-7 py-3 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90 hover:shadow-[0_0_20px_rgba(0,212,255,0.3)]"
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
          className="rounded-xl border border-border px-5 py-3 text-sm font-medium text-muted-foreground transition-all hover:bg-secondary hover:text-foreground"
        >
          <RotateCw className="h-4 w-4" />
        </button>
        <button
          onClick={handleSave}
          disabled={timeElapsed === 0 || isSaving}
          className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-7 py-3 text-sm font-semibold text-emerald-400 transition-all hover:bg-emerald-500/20 disabled:opacity-50"
        >
          {isSaving ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
              Salvando...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" /> Salvar Sessão
            </>
          )}
        </button>
      </div>
    </div>
  );
}

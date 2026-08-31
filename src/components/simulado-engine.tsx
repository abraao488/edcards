"use client"

import { useState, useEffect } from "react"
import { Clock, RotateCcw, ChevronLeft, ChevronRight } from "lucide-react"

interface QuestionData {
  id: string
  statement: string
  options: string[]
  correctIndex: number
  explanation: string | null
}

export function SimuladoEngine({ questions }: { questions: QuestionData[] }) {
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [finished, setFinished] = useState(false)
  const [startTime] = useState(Date.now())
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (finished) return
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [startTime, finished])

  const current = questions[index]
  if (!questions.length) {
    return (
      <div className="py-20 text-center text-muted-foreground">
        Nenhuma questão cadastrada. Crie questões primeiro.
      </div>
    )
  }

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, "0")}`
  }

  function handleSelect(optionIndex: number) {
    if (revealed) return
    setSelected(optionIndex)
    setAnswers({ ...answers, [current.id]: optionIndex })
    setRevealed(true)
  }

  function next() {
    if (index < questions.length - 1) {
      setIndex(index + 1)
      setSelected(null)
      setRevealed(false)
    } else {
      setFinished(true)
    }
  }

  function prev() {
    if (index > 0) {
      setIndex(index - 1)
      const prevAnswer = answers[questions[index - 1].id]
      setSelected(prevAnswer ?? null)
      setRevealed(prevAnswer !== undefined)
    }
  }

  function restart() {
    setIndex(0)
    setSelected(null)
    setRevealed(false)
    setAnswers({})
    setFinished(false)
  }

  if (finished) {
    const total = questions.length
    const correct = questions.filter(
      (q) => answers[q.id] === q.correctIndex
    ).length
    const percentage = Math.round((correct / total) * 100)

    return (
      <div className="mx-auto max-w-xl py-10 text-center">
        <h2 className="mb-4 text-2xl font-bold text-foreground">
          Simulado Concluído!
        </h2>
        <div className="mb-8 grid grid-cols-3 gap-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-3xl font-bold text-green-400">{correct}</p>
            <p className="text-sm text-muted-foreground">Acertos</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-3xl font-bold text-red-400">{total - correct}</p>
            <p className="text-sm text-muted-foreground">Erros</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-3xl font-bold text-primary">{percentage}%</p>
            <p className="text-sm text-muted-foreground">Aproveitamento</p>
          </div>
        </div>
        <button
          onClick={restart}
          className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <RotateCcw className="h-4 w-4" /> Recomeçar
        </button>
      </div>
    )
  }

  const letter = (i: number) => String.fromCharCode(65 + i)

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Questão {index + 1} de {questions.length}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="h-4 w-4" /> {formatTime(elapsed)}
        </span>
      </div>

      <div className="mb-6 rounded-xl border border-border bg-card p-6">
        <p className="mb-6 text-lg font-semibold text-foreground">
          {current.statement}
        </p>
        <div className="space-y-2">
          {current.options.map((opt, i) => {
            const isSelected = selected === i
            const isCorrect = i === current.correctIndex
            let borderClass = "border-border hover:border-primary/50"
            let bgClass = "hover:bg-secondary"
            let textClass = "text-foreground"

            if (revealed) {
              if (isCorrect) {
                borderClass = "border-green-500"
                bgClass = "bg-green-500/10"
                textClass = "text-green-400"
              } else if (isSelected && !isCorrect) {
                borderClass = "border-red-500"
                bgClass = "bg-red-500/10"
                textClass = "text-red-400"
              }
            } else if (isSelected) {
              borderClass = "border-primary"
              bgClass = "bg-primary/10"
            }

            return (
              <button
                key={i}
                onClick={() => handleSelect(i)}
                className={`flex w-full items-center rounded-lg border px-4 py-3 text-left text-sm transition-colors ${borderClass} ${bgClass} ${textClass}`}
              >
                <span className="mr-3 flex h-6 w-6 items-center justify-center rounded-full border border-current text-xs font-medium">
                  {letter(i)}
                </span>
                {opt}
              </button>
            )
          })}
        </div>
        {revealed && current.explanation && (
          <div className="mt-4 rounded-lg border border-border bg-secondary/50 p-3">
            <p className="text-sm text-muted-foreground">{current.explanation}</p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={prev}
          disabled={index === 0}
          className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
        >
          <ChevronLeft className="h-4 w-4" /> Anterior
        </button>
        <button
          onClick={next}
          className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {index < questions.length - 1 ? "Próxima" : "Finalizar"}
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

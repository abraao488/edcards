"use client"

import { useState, useEffect } from "react"
import { Plus, X } from "lucide-react"
import { createQuestion } from "@/lib/questoes/actions"
import { getSubjectsWithTopics } from "@/lib/subjects/actions"

interface SubjectOption {
  id: string
  name: string
}

export function CreateQuestionDialog() {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [optionCount, setOptionCount] = useState(4)
  const [correctIndex, setCorrectIndex] = useState(0)
  const [subjects, setSubjects] = useState<SubjectOption[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      getSubjectsWithTopics().then(setSubjects)
    }
  }, [open])

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
      >
        <Plus className="h-4 w-4" />
        Nova Questão
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 pt-10">
          <div className="mb-10 w-full max-w-2xl rounded-xl border border-border bg-card p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Nova Questão</h2>
              <button onClick={() => { setOpen(false); setError(null) }} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form
              action={async (formData) => {
                setError(null)
                setLoading(true)
                try {
                  const result = await createQuestion(formData)
                  if (result?.error) setError(result.error)
                  else setOpen(false)
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Erro ao criar questão")
                } finally {
                  setLoading(false)
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground" htmlFor="statement">
                  Enunciado
                </label>
                <textarea
                  id="statement"
                  name="statement"
                  required
                  rows={3}
                  className="w-full rounded-lg border border-border bg-secondary px-4 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="Qual é a capital do Brasil?"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground" htmlFor="subject">
                    Matéria
                  </label>
                  <select
                    id="subject"
                    name="subject"
                    required
                    className="w-full rounded-lg border border-border bg-secondary px-4 py-2 text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">Selecione...</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.name}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground" htmlFor="difficulty">
                    Dificuldade
                  </label>
                  <select
                    id="difficulty"
                    name="difficulty"
                    className="w-full rounded-lg border border-border bg-secondary px-4 py-2 text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="EASY">Fácil</option>
                    <option value="MEDIUM">Médio</option>
                    <option value="HARD">Difícil</option>
                  </select>
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm font-medium text-foreground">Opções</label>
                  <div className="flex items-center gap-1">
                    {[2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => {
                          setOptionCount(n)
                          if (correctIndex >= n) setCorrectIndex(n - 1)
                        }}
                        className={`rounded px-2 py-0.5 text-xs ${
                          optionCount === n
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
                {Array.from({ length: optionCount }).map((_, i) => (
                  <div key={i} className="mb-2 flex items-center gap-3">
                    <input
                      type="radio"
                      name="correctIndex"
                      value={i}
                      checked={correctIndex === i}
                      onChange={() => setCorrectIndex(i)}
                      className="h-4 w-4 accent-primary"
                    />
                    <input
                      name={`option_${i}`}
                      required
                      className="flex-1 rounded-lg border border-border bg-secondary px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      placeholder={`Opção ${String.fromCharCode(65 + i)}`}
                    />
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">
                  Selecione o círculo ao lado da opção correta.
                </p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-foreground" htmlFor="explanation">
                  Explicação (opcional)
                </label>
                <textarea
                  id="explanation"
                  name="explanation"
                  rows={2}
                  className="w-full rounded-lg border border-border bg-secondary px-4 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="Explique por que essa é a resposta correta..."
                />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setOpen(false); setError(null) }}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                >
                  {loading ? "Criando..." : "Criar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

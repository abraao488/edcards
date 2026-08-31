"use client"

import { useState, useEffect } from "react"
import { Plus } from "lucide-react"
import { createFlashcard } from "@/lib/flashcards/actions"
import { getSubjectsWithTopics } from "@/lib/subjects/actions"

interface SubjectWithTopics {
  id: string
  name: string
  topics: { id: string; name: string }[]
}

export function CreateCardDialog({ deckId }: { deckId: string }) {
  const [open, setOpen] = useState(false)
  const [subjects, setSubjects] = useState<SubjectWithTopics[]>([])
  const [selectedSubjectId, setSelectedSubjectId] = useState("")
  const [cardType, setCardType] = useState<"BASIC" | "REVERSED" | "CLOZE">("BASIC")

  useEffect(() => {
    if (open) {
      getSubjectsWithTopics().then(setSubjects)
    }
  }, [open])

  const selectedSubject = subjects.find((s) => s.id === selectedSubjectId)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
      >
        <Plus className="h-4 w-4" />
        Novo Card
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6">
            <h2 className="mb-4 text-lg font-semibold text-foreground">
              Novo Flashcard
            </h2>
            <form
              action={async (formData) => {
                if (selectedSubjectId) {
                  formData.set("subjectId", selectedSubjectId)
                }
                await createFlashcard(deckId, formData)
                setOpen(false)
                setSelectedSubjectId("")
              }}
              className="space-y-4"
            >
              {subjects.length > 0 && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">
                    Matéria (opcional)
                  </label>
                  <select
                    name="subjectId"
                    value={selectedSubjectId}
                    onChange={(e) => setSelectedSubjectId(e.target.value)}
                    className="w-full rounded-lg border border-border bg-secondary px-4 py-2 text-foreground"
                  >
                    <option value="">Selecione a matéria...</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {selectedSubject && selectedSubject.topics.length > 0 && (
                <div className="rounded-lg bg-secondary/50 p-3 text-sm text-muted-foreground">
                  Assuntos: {selectedSubject.topics.map((t) => t.name).join(", ")}
                </div>
              )}

              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  Tipo de Cartão
                </label>
                <select
                  name="cardType"
                  value={cardType}
                  onChange={(e) => setCardType(e.target.value as "BASIC" | "REVERSED" | "CLOZE")}
                  className="w-full rounded-lg border border-border bg-secondary px-4 py-2 text-foreground"
                >
                  <option value="BASIC">Básico (Frente/Verso)</option>
                  <option value="REVERSED">Básico + Cartão Invertido</option>
                  <option value="CLOZE">Omissão de Palavras (Cloze)</option>
                </select>
              </div>

              <div>
                <label
                  className="mb-1 block text-sm font-medium text-foreground"
                  htmlFor="front"
                >
                  {cardType === "CLOZE" ? "Texto com Omissão" : "Frente (pergunta)"}
                </label>
                <textarea
                  id="front"
                  name="front"
                  required
                  rows={3}
                  className="w-full rounded-lg border border-border bg-secondary px-4 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder={
                    cardType === "CLOZE"
                      ? "Ex: A CF foi promulgada em {{c1::1988}}."
                      : "Ex: Qual é o princípio da legalidade?"
                  }
                />
              </div>

              {cardType === "CLOZE" && (
                <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/5 p-3 text-sm">
                  <p className="font-medium text-cyan-400 mb-1">Dica para Cloze</p>
                  <p className="text-cyan-300/90">
                    Use <code className="rounded bg-cyan-500/20 px-1 text-cyan-200">{`{{c1::palavra}}`}</code> para marcar a palavra que você quer omitir.
                  </p>
                </div>
              )}

              {cardType !== "CLOZE" && (
                <div>
                  <label
                    className="mb-1 block text-sm font-medium text-foreground"
                    htmlFor="back"
                  >
                    Verso (resposta)
                  </label>
                  <textarea
                    id="back"
                    name="back"
                    required
                    rows={3}
                    className="w-full rounded-lg border border-border bg-secondary px-4 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="Ex: Ninguém será obrigado a fazer ou deixar de fazer..."
                  />
                </div>
              )}
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  Criar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

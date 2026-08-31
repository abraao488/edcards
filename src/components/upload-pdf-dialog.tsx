"use client"

import { useState, useEffect } from "react"
import { Upload } from "lucide-react"
import { uploadDocument } from "@/lib/materiais/actions"
import { getSubjectsWithTopics } from "@/lib/subjects/actions"

interface SubjectOption {
  id: string
  name: string
}

export function UploadPdfDialog() {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
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
        <Upload className="h-4 w-4" />
        Enviar PDF
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6">
            <h2 className="mb-4 text-lg font-semibold text-foreground">
              Enviar Material
            </h2>
            <form
              action={async (formData) => {
                setError(null)
                setLoading(true)
                try {
                  const result = await uploadDocument(formData)
                  if (result?.error) {
                    setError(result.error)
                  } else {
                    setOpen(false)
                  }
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Erro ao enviar material")
                } finally {
                  setLoading(false)
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground" htmlFor="title">
                  Título
                </label>
                <input
                  id="title"
                  name="title"
                  required
                  className="w-full rounded-lg border border-border bg-secondary px-4 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="Ex: Direito Administrativo - Resumo"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground" htmlFor="subject">
                  Matéria
                </label>
                <select
                  id="subject"
                  name="subject"
                  className="w-full rounded-lg border border-border bg-secondary px-4 py-2 text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">Selecione a matéria...</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground" htmlFor="file">
                  Arquivo PDF
                </label>
                <input
                  id="file"
                  name="file"
                  type="file"
                  accept=".pdf"
                  required
                  className="w-full rounded-lg border border-border bg-secondary px-4 py-2 text-sm text-foreground file:mr-3 file:rounded file:border-0 file:bg-primary/10 file:px-3 file:py-1 file:text-sm file:font-medium file:text-primary"
                />
              </div>
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
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
                  {loading ? "Enviando..." : "Enviar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

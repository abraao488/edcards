"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import { createDeck } from "@/lib/flashcards/actions"

export function CreateDeckDialog() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
      >
        <Plus className="h-4 w-4" />
        Novo Baralho
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6">
            <h2 className="mb-4 text-lg font-semibold text-foreground">
              Novo Baralho
            </h2>
            <form
              action={async (formData) => {
                await createDeck(formData)
                setOpen(false)
              }}
              className="space-y-4"
            >
              <div>
                <label
                  className="mb-1 block text-sm font-medium text-foreground"
                  htmlFor="name"
                >
                  Nome
                </label>
                <input
                  id="name"
                  name="name"
                  required
                  className="w-full rounded-lg border border-border bg-secondary px-4 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="Ex: Direito Penal"
                />
              </div>
              <div>
                <label
                  className="mb-1 block text-sm font-medium text-foreground"
                  htmlFor="description"
                >
                  Descrição (opcional)
                </label>
                <textarea
                  id="description"
                  name="description"
                  rows={2}
                  className="w-full rounded-lg border border-border bg-secondary px-4 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="Breve descrição do baralho"
                />
              </div>
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

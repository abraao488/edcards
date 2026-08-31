"use client"

import { useState } from "react"
import { SlidersHorizontal, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { organizeOverdueCards } from "@/lib/flashcards/organize-actions"

export function OrganizarClient() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isOrganizing, setIsOrganizing] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const handleOrganize = async () => {
    setIsOrganizing(true)
    try {
      const result = await organizeOverdueCards()
      setSuccessMessage(`${result.count} cards reorganizados com sucesso!`)
      setIsModalOpen(false)
    } catch (error) {
      console.error(error)
    } finally {
      setIsOrganizing(false)
    }
  }

  return (
    <div className="relative max-w-2xl w-full text-center">
      <div className="flex flex-col items-center gap-6">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary shadow-[0_0_20px_rgba(0,212,255,0.15)]">
          <SlidersHorizontal className="h-10 w-10" />
        </div>
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-foreground mb-2">
            Cards acumulados geram ansiedade.
          </h1>
          <p className="text-xl text-muted-foreground">
            Vamos reorganizar sua fila de estudos?
          </p>
        </div>

        {successMessage ? (
          <div className="flex items-center gap-3 text-primary bg-primary/10 px-6 py-4 rounded-xl border border-primary/25">
            <CheckCircle2 className="h-6 w-6" />
            <span className="text-lg font-medium">{successMessage}</span>
          </div>
        ) : (
          <Button
            size="lg"
            onClick={() => setIsModalOpen(true)}
            className="animate-pulse text-lg px-8 py-6"
          >
            Organizar meus Cards Atrasados
          </Button>
        )}
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reorganizar Cards Atrasados</DialogTitle>
            <DialogDescription>
              Deseja redistribuir os cards atrasados a partir de hoje?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleOrganize} disabled={isOrganizing}>
              {isOrganizing ? "Organizando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

"use client"

import { useState } from "react"
import { useFormState } from "react-dom"
import { Brain } from "lucide-react"
import { updatePassword } from "@/lib/auth/actions"

export function ResetPasswordForm() {
  const [state, formAction] = useFormState(updatePassword, undefined)
  const [confirmError, setConfirmError] = useState<string | null>(null)

  return (
    <div className="w-full max-w-md space-y-8 rounded-xl border border-border bg-card p-8">
      <div className="flex flex-col items-center gap-2">
        <Brain className="h-10 w-10 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Criar nova senha</h1>
        <p className="text-center text-sm text-muted-foreground">
          Escolha uma nova senha para acessar sua conta
        </p>
      </div>
      <form
        action={formAction}
        className="space-y-4"
        onSubmit={(e) => {
          const form = e.currentTarget
          const password = (form.elements.namedItem("password") as HTMLInputElement)?.value
          const confirmPassword = (
            form.elements.namedItem("confirmPassword") as HTMLInputElement
          )?.value

          if (password !== confirmPassword) {
            e.preventDefault()
            setConfirmError("As senhas não coincidem")
            return
          }
          setConfirmError(null)
        }}
      >
        <div>
          <label className="mb-1 block text-sm font-medium text-foreground" htmlFor="password">
            Nova senha
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            className="w-full rounded-lg border border-border bg-secondary px-4 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="••••••••"
            onChange={() => {
              if (confirmError) setConfirmError(null)
            }}
          />
        </div>
        <div>
          <label
            className="mb-1 block text-sm font-medium text-foreground"
            htmlFor="confirmPassword"
          >
            Confirmar nova senha
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            className="w-full rounded-lg border border-border bg-secondary px-4 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="••••••••"
            onChange={() => {
              if (confirmError) setConfirmError(null)
            }}
          />
        </div>
        {confirmError && <p className="text-sm text-destructive">{confirmError}</p>}
        {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
        <button
          type="submit"
          className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Salvar nova senha
        </button>
      </form>
    </div>
  )
}

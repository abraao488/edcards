"use client"

import { useState } from "react"
import { useFormState } from "react-dom"
import { register } from "@/lib/auth/actions"
import { Brain } from "lucide-react"
import Link from "next/link"

export function RegisterForm() {
  const [state, formAction] = useFormState(register, undefined)
  const [confirmError, setConfirmError] = useState<string | null>(null)

  return (
    <div className="w-full max-w-md space-y-8 rounded-xl border border-border bg-card p-8">
      <div className="flex flex-col items-center gap-2">
        <Brain className="h-10 w-10 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Criar Conta</h1>
        <p className="text-sm text-muted-foreground">
          Comece a revisar com inteligência
        </p>
      </div>
      <form
        action={formAction}
        className="space-y-4"
        onSubmit={(e) => {
          const form = e.currentTarget
          const password = (form.elements.namedItem("password") as HTMLInputElement)?.value
          const confirmPassword = (form.elements.namedItem("confirmPassword") as HTMLInputElement)?.value

          if (password !== confirmPassword) {
            e.preventDefault()
            setConfirmError("As senhas não coincidem")
            return
          }
          setConfirmError(null)
        }}
      >
        <div>
          <label className="mb-1 block text-sm font-medium text-foreground" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="w-full rounded-lg border border-border bg-secondary px-4 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="seu@email.com"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-foreground" htmlFor="password">
            Senha
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={6}
            className="w-full rounded-lg border border-border bg-secondary px-4 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="••••••••"
            onChange={() => {
              if (confirmError) setConfirmError(null)
            }}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-foreground" htmlFor="confirmPassword">
            Confirmar senha
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            required
            minLength={6}
            className="w-full rounded-lg border border-border bg-secondary px-4 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="••••••••"
            onChange={() => {
              if (confirmError) setConfirmError(null)
            }}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-foreground" htmlFor="concurrence">
            Concurso de interesse (opcional)
          </label>
          <input
            id="concurrence"
            name="concurrence"
            type="text"
            className="w-full rounded-lg border border-border bg-secondary px-4 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="Ex: Polícia Militar do Alagoas"
          />
        </div>
        <div className="flex items-start gap-3 rounded-lg border border-border bg-secondary/40 p-3">
          <input
            id="acceptTerms"
            name="acceptTerms"
            type="checkbox"
            required
            className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-primary"
          />
          <label
            htmlFor="acceptTerms"
            className="text-xs leading-relaxed text-muted-foreground"
          >
            Li e concordo com os{" "}
            <Link
              href="/termos"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary hover:underline"
            >
              Termos de Uso
            </Link>{" "}
            e com a{" "}
            <Link
              href="/privacidade"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary hover:underline"
            >
              Política de Privacidade
            </Link>
            .
          </label>
        </div>
        {confirmError && (
          <p className="text-sm text-destructive">{confirmError}</p>
        )}
        {state?.error && (
          <p className="text-sm text-destructive">{state.error}</p>
        )}
        <button
          type="submit"
          className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Criar Conta
        </button>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        Já tem conta?{" "}
        <Link href="/login" className="text-primary hover:underline">
          Entrar
        </Link>
      </p>
    </div>
  )
}

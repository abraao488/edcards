"use client"

import { useFormState } from "react-dom"
import { login } from "@/lib/auth/actions"
import { Brain } from "lucide-react"
import Link from "next/link"

export function LoginForm() {
  const [state, formAction] = useFormState(login, undefined)

  return (
    <div className="w-full max-w-md space-y-8 rounded-xl border border-border bg-card p-8">
      <div className="flex flex-col items-center gap-2">
        <Brain className="h-10 w-10 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Entrar</h1>
        <p className="text-sm text-muted-foreground">
          Acesse sua conta para continuar estudando
        </p>
      </div>
      <form action={formAction} className="space-y-4">
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
            className="w-full rounded-lg border border-border bg-secondary px-4 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="••••••••"
          />
        </div>
        {state?.error && (
          <p className="text-sm text-destructive">{state.error}</p>
        )}
        <button
          type="submit"
          className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Entrar
        </button>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        Não tem conta?{" "}
        <Link href="/register" className="text-primary hover:underline">
          Criar conta
        </Link>
      </p>
    </div>
  )
}

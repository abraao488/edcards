"use client"

import { useFormState } from "react-dom"
import Link from "next/link"
import { Brain, MailCheck } from "lucide-react"
import { requestPasswordReset } from "@/lib/auth/actions"

export function ForgotPasswordForm() {
  const [state, formAction] = useFormState(requestPasswordReset, undefined)

  if (state?.success) {
    return (
      <div className="w-full max-w-md space-y-6 rounded-xl border border-border bg-card p-8 text-center">
        <div className="flex flex-col items-center gap-2">
          <MailCheck className="h-10 w-10 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Verifique seu e-mail</h1>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Se houver uma conta associada ao e-mail informado, enviamos um link para
          redefinir sua senha. O link expira em pouco tempo por segurança — confira
          também a caixa de spam.
        </p>
        <Link
          href="/login"
          className="inline-block text-sm font-medium text-primary hover:underline"
        >
          Voltar para o login
        </Link>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md space-y-8 rounded-xl border border-border bg-card p-8">
      <div className="flex flex-col items-center gap-2">
        <Brain className="h-10 w-10 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Recuperar senha</h1>
        <p className="text-center text-sm text-muted-foreground">
          Informe seu e-mail e enviaremos um link para criar uma nova senha
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
            autoComplete="email"
            className="w-full rounded-lg border border-border bg-secondary px-4 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="seu@email.com"
          />
        </div>
        {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
        <button
          type="submit"
          className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Enviar link de recuperação
        </button>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        Lembrou a senha?{" "}
        <Link href="/login" className="text-primary hover:underline">
          Entrar
        </Link>
      </p>
    </div>
  )
}

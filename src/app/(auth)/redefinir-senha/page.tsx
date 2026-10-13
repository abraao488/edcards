import Link from "next/link"
import type { Metadata } from "next"
import { AlertTriangle } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { ResetPasswordForm } from "@/components/reset-password-form"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Nova senha - Edcards",
  description: "Defina uma nova senha para sua conta Edcards.",
}

export default async function RedefinirSenhaPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Sem sessão de recuperação válida: o link expirou ou já foi utilizado.
  if (!user) {
    return (
      <div className="w-full max-w-md space-y-6 rounded-xl border border-border bg-card p-8 text-center">
        <div className="flex flex-col items-center gap-3">
          <AlertTriangle className="h-10 w-10 text-amber-400" />
          <h1 className="text-2xl font-bold text-foreground">Link inválido ou expirado</h1>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Este link de redefinição de senha não é mais válido. Solicite um novo link
          para continuar.
        </p>
        <Link
          href="/recuperar-senha"
          className="inline-block rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Solicitar novo link
        </Link>
      </div>
    )
  }

  return <ResetPasswordForm />
}

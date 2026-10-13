import type { Metadata } from "next"
import { ForgotPasswordForm } from "@/components/forgot-password-form"

export const metadata: Metadata = {
  title: "Recuperar senha - Edcards",
  description: "Redefina a senha da sua conta Edcards.",
}

export default function RecuperarSenhaPage() {
  return <ForgotPasswordForm />
}

import { cookies } from "next/headers"
import { RegisterForm } from "@/components/register-form"

export const dynamic = "force-dynamic"

interface RegisterPageProps {
  searchParams?: { ref?: string }
}

export default function RegisterPage({ searchParams }: RegisterPageProps) {
  // Atribuição de convite: prioriza ?ref= da URL; se ausente, usa o cookie
  // gravado pelo middleware quando o visitante veio de um link de convite.
  const fromQuery = (searchParams?.ref ?? "").trim()
  const fromCookie = cookies().get("ed_ref")?.value ?? ""
  const referralCode = (fromQuery || fromCookie)
    .replace(/[^A-Za-z0-9]/g, "")
    .slice(0, 16)

  return <RegisterForm referralCode={referralCode} />
}

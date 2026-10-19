"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { prisma } from "@/lib/prisma"
import { getSiteOrigin } from "@/lib/site"
import { linkReferral } from "@/lib/referral/service"
import { recordEvent } from "@/lib/analytics/events"
import {
  clearAttempts,
  getClientIp,
  isRateLimited,
  registerFailedAttempt,
} from "@/lib/rate-limit"

type AuthState = { error?: string } | undefined
type ResetState = { error?: string; success?: boolean } | undefined

const RATE_LIMIT_MESSAGE =
  "Muitas tentativas. Aguarde alguns minutos e tente novamente."

export async function login(_prevState: AuthState, formData: FormData): Promise<AuthState> {
  const supabase = await createClient()

  const data = {
    email: (formData.get("email") as string) || "",
    password: (formData.get("password") as string) || "",
  }

  // Bloqueio temporário após tentativas repetidas (por e-mail e por IP)
  const emailKey = `login:email:${data.email.trim().toLowerCase()}`
  const ipKey = `login:ip:${getClientIp()}`
  if (isRateLimited(emailKey) || isRateLimited(ipKey)) {
    return { error: RATE_LIMIT_MESSAGE }
  }

  const { error } = await supabase.auth.signInWithPassword(data)

  if (error) {
    // Conta a tentativa falha; ao estourar a janela, a chave é bloqueada
    registerFailedAttempt(emailKey, 5)
    registerFailedAttempt(ipKey, 10)
    return { error: error.message }
  }

  clearAttempts(emailKey)
  clearAttempts(ipKey)

  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    await prisma.user.upsert({
      where: { id: user.id },
      create: {
        id: user.id,
        email: user.email || "",
      },
      update: {},
    })
  }

  revalidatePath("/dashboard")
  redirect("/dashboard")
}

export async function register(_prevState: AuthState, formData: FormData): Promise<AuthState> {
  const supabase = await createClient()
  const adminClient = createAdminClient()

  const email = (formData.get("email") as string) || ""
  const password = formData.get("password") as string
  const concurrence = formData.get("concurrence") as string
  // Código de indicação (link de convite). Opcional.
  const referralCode = (formData.get("ref") as string) || null

  // Aceite obrigatório dos documentos legais (regra de negócio + LGPD/CDC)
  if (!formData.get("acceptTerms")) {
    return {
      error:
        "É necessário aceitar os Termos de Uso e a Política de Privacidade para criar a conta.",
    }
  }

  // Bloqueio temporário: conta tentativas de cadastro por IP e por e-mail
  const emailKey = `register:email:${email.trim().toLowerCase()}`
  const ipKey = `register:ip:${getClientIp()}`
  if (isRateLimited(emailKey) || isRateLimited(ipKey)) {
    return { error: RATE_LIMIT_MESSAGE }
  }
  registerFailedAttempt(emailKey, 5)
  registerFailedAttempt(ipKey, 10)

  const { data: signUpData, error } = await supabase.auth.signUp({ email, password })

  if (error) {
    return { error: error.message }
  }

  if (signUpData.user) {
    await adminClient.auth.admin.updateUserById(signUpData.user.id, {
      email_confirm: true,
    })

    await prisma.user.upsert({
      where: { id: signUpData.user.id },
      create: {
        id: signUpData.user.id,
        email: email,
      },
      update: {},
    })

    await prisma.profile.create({
      data: {
        userId: signUpData.user.id,
        concurrenceName: concurrence || null,
      },
    })

    // Atribuição de indicação: melhor esforço — nunca deve derrubar o cadastro.
    if (referralCode) {
      try {
        await linkReferral(signUpData.user.id, referralCode)
      } catch (err) {
        console.error("[referral] Falha ao vincular indicação:", err)
      }
    }

    await recordEvent("user_registered", {
      userId: signUpData.user.id,
      properties: { referred: Boolean(referralCode) },
    })
  }

  const { error: loginError } = await supabase.auth.signInWithPassword({ email, password })

  if (loginError) {
    return { error: loginError.message }
  }

  revalidatePath("/dashboard")
  redirect("/bem-vindo")
}

/**
 * Envia o e-mail de redefinição de senha usando o fluxo nativo do Supabase Auth.
 * O link recebido aponta para /api/auth/callback (troca o código por sessão) e
 * em seguida redireciona para /redefinir-senha.
 */
export async function requestPasswordReset(
  _prevState: ResetState,
  formData: FormData
): Promise<ResetState> {
  const supabase = await createClient()
  const email = ((formData.get("email") as string) || "").trim()

  if (!email) {
    return { error: "Informe o e-mail cadastrado." }
  }

  const emailKey = `reset:email:${email.toLowerCase()}`
  const ipKey = `reset:ip:${getClientIp()}`
  if (isRateLimited(emailKey) || isRateLimited(ipKey)) {
    return { error: RATE_LIMIT_MESSAGE }
  }
  registerFailedAttempt(emailKey, 5)
  registerFailedAttempt(ipKey, 10)

  const origin = await getSiteOrigin()
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/api/auth/callback?next=/redefinir-senha`,
  })

  // Não revelamos se o e-mail existe na base (evita enumeração de usuários).
  if (error) {
    console.error("[auth] Falha ao enviar e-mail de redefinição:", error.message)
  }

  return { success: true }
}

/** Define uma nova senha para o usuário autenticado via link de recuperação. */
export async function updatePassword(
  _prevState: ResetState,
  formData: FormData
): Promise<ResetState> {
  const supabase = await createClient()
  const password = (formData.get("password") as string) || ""
  const confirmPassword = (formData.get("confirmPassword") as string) || ""

  if (password.length < 6) {
    return { error: "A senha deve ter ao menos 6 caracteres." }
  }

  if (password !== confirmPassword) {
    return { error: "As senhas não coincidem." }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      error:
        "Sessão de redefinição inválida ou expirada. Solicite um novo link em /recuperar-senha.",
    }
  }

  const { error } = await supabase.auth.updateUser({ password })

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/dashboard")
  redirect("/dashboard")
}

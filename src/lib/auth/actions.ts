"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { prisma } from "@/lib/prisma"
import {
  clearAttempts,
  getClientIp,
  isRateLimited,
  registerFailedAttempt,
} from "@/lib/rate-limit"

type AuthState = { error?: string } | undefined

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
  }

  const { error: loginError } = await supabase.auth.signInWithPassword({ email, password })

  if (loginError) {
    return { error: loginError.message }
  }

  revalidatePath("/dashboard")
  redirect("/bem-vindo")
}

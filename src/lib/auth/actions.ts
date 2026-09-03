"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { prisma } from "@/lib/prisma"

type AuthState = { error?: string } | undefined

export async function login(_prevState: AuthState, formData: FormData): Promise<AuthState> {
  const supabase = await createClient()

  const data = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  }

  const { error } = await supabase.auth.signInWithPassword(data)

  if (error) {
    return { error: error.message }
  }

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

  const email = formData.get("email") as string
  const password = formData.get("password") as string
  const concurrence = formData.get("concurrence") as string

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

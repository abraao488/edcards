"use server"

import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"

export async function ensureUserExists() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Não autenticado")

  await prisma.user.upsert({
    where: { id: user.id },
    create: {
      id: user.id,
      email: user.email || "",
    },
    update: {},
  })

  return user
}

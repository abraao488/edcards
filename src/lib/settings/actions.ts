"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { ensureUserExists } from "@/lib/auth/sync"
import { getOrCreateActiveProfile } from "@/lib/profile/helpers"

export async function getUserSettings() {
  const user = await ensureUserExists()

  return prisma.userSettings.findUnique({
    where: { userId: user.id },
  })
}

export async function updateAISetting(aiEnabled: boolean) {
  const user = await ensureUserExists()

  await prisma.userSettings.upsert({
    where: { userId: user.id },
    create: { userId: user.id, aiEnabled },
    update: { aiEnabled },
  })

  revalidatePath("/dashboard/configuracoes")
}

export async function updatePomodoroSetting(pomodoroMin: number) {
  const user = await ensureUserExists()

  await prisma.userSettings.upsert({
    where: { userId: user.id },
    create: { userId: user.id, pomodoroMin },
    update: { pomodoroMin },
  })

  revalidatePath("/dashboard/configuracoes")
  revalidatePath("/gerenciador")
  revalidatePath("/flashcards")
  revalidatePath("/materias")
  revalidatePath("/dashboard/flashcards/consultation")
  revalidatePath("/dashboard/flashcards/[deckId]", "page")
  revalidatePath("/dashboard")
}

export async function updateBreakSetting(breakDuration: number) {
  const user = await ensureUserExists()

  await prisma.userSettings.upsert({
    where: { userId: user.id },
    create: { userId: user.id, breakDuration },
    update: { breakDuration },
  })

  revalidatePath("/dashboard/configuracoes")
  revalidatePath("/gerenciador")
  revalidatePath("/flashcards")
  revalidatePath("/materias")
  revalidatePath("/dashboard/flashcards/consultation")
  revalidatePath("/dashboard/flashcards/[deckId]", "page")
  revalidatePath("/dashboard")
}

export async function updateConcurrence(concurrenceName: string) {
  const user = await ensureUserExists()

  const activeProfile = await getOrCreateActiveProfile(user.id, user.email || "")

  await prisma.profile.update({
    where: { id: activeProfile.id },
    data: { concurrenceName },
  })

  revalidatePath("/dashboard")
  revalidatePath("/dashboard/configuracoes")
}
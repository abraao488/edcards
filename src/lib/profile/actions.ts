"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { getOrCreateActiveProfile } from "@/lib/profile/helpers"

export async function updateProfile(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const name = formData.get("name") as string
  const avatarUrl = formData.get("avatarUrl") as string
  const concurrenceName = formData.get("concurrenceName") as string

  const activeProfile = await getOrCreateActiveProfile(user.id, user.email || "")

  await prisma.profile.update({
    where: { id: activeProfile.id },
    data: {
      name: name || null,
      avatarUrl: avatarUrl || null,
      concurrenceName: concurrenceName || null,
    },
  })

  revalidatePath("/dashboard/configuracoes")
  revalidatePath("/dashboard")
}

export async function getProfilesAndSubscription() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const [dbUser, subscription] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      include: { profiles: { orderBy: { createdAt: "asc" } } },
    }),
    prisma.subscription.findUnique({ where: { userId: user.id } }),
  ])

  if (!dbUser) throw new Error("User not found")

  return {
    profiles: dbUser.profiles,
    subscription,
    activeProfileId: dbUser.activeProfileId,
  }
}

export async function switchProfile(profileId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  // First, set all profiles to inactive
  await prisma.profile.updateMany({
    where: { userId: user.id },
    data: { isActiveProfile: false },
  })

  // Then, set the selected profile to active
  await prisma.profile.update({
    where: { id: profileId, userId: user.id },
    data: { isActiveProfile: true },
  })

  // Also update user's activeProfileId
  await prisma.user.update({
    where: { id: user.id },
    data: { activeProfileId: profileId },
  })

  revalidatePath("/dashboard/configuracoes")
  revalidatePath("/dashboard")
}

export async function createProfile(name: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const [dbUser, subscription] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      include: { profiles: true },
    }),
    prisma.subscription.findUnique({ where: { userId: user.id } }),
  ])

  if (!dbUser) throw new Error("User not found")

  const maxProfiles =
    subscription?.plan === "GRUPO" ? 5 : subscription?.plan === "DUPLA" ? 2 : 1

  if (dbUser.profiles.length >= maxProfiles) {
    throw new Error("Limite de perfis atingido para seu plano")
  }

  // Set all existing profiles to inactive
  await prisma.profile.updateMany({
    where: { userId: user.id },
    data: { isActiveProfile: false },
  })

  const newProfile = await prisma.profile.create({
    data: {
      userId: user.id,
      name,
      isActiveProfile: true,
    },
  })

  await prisma.user.update({
    where: { id: user.id },
    data: { activeProfileId: newProfile.id },
  })

  revalidatePath("/dashboard/configuracoes")
  revalidatePath("/dashboard")
}

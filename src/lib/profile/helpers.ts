"use server"

import { prisma } from "@/lib/prisma"

export async function getOrCreateActiveProfile(userId: string, email: string) {
  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      profiles: {
        orderBy: { createdAt: "asc" },
      },
    },
  })

  if (!dbUser) {
    throw new Error("Usuário não encontrado.")
  }

  let activeProfile =
    dbUser.profiles.find(
      (profile) => profile.id === dbUser.activeProfileId || profile.isActiveProfile
    ) ?? dbUser.profiles[0]

  if (!activeProfile) {
    activeProfile = await prisma.profile.create({
      data: {
        userId: dbUser.id,
        name: email.split("@")[0] || "Usuário",
        isActiveProfile: true,
      },
    })
  }

  return activeProfile
}

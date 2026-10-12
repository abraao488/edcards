import { prisma } from "@/lib/prisma"

/**
 * Helper interno de servidor (NÃO é Server Action).
 *
 * Mantido fora de um arquivo com "use server" de propósito: todas as funções
 * exportadas de um arquivo "use server" viram endpoints RPC públicos no
 * bundle do client, mesmo que ninguém as chame de lá. Esta função só faz
 * leitura/escrita interna e é usada por Server Components e por outras
 * Server Actions, então não precisa (nem pode, por receber userId arbitrário)
 * ser exposta ao client.
 */
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

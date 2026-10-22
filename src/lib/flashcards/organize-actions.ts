"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { ensureUserExists } from "@/lib/auth/sync"
import { requireActiveSubscriptionForAction } from "@/lib/subscription/guard"
import { reorganizeOverdueCards } from "@/lib/flashcards/organize-core"

// Revalidate é inofensivo fora de uma request; falhas aqui nunca podem
// invalidar a operação de banco já concluída.
function safeRevalidate(paths: string[]) {
  for (const path of paths) {
    try {
      revalidatePath(path)
    } catch {
      // environment sem request context (ex.: testes) — ignora
    }
  }
}

/**
 * Resolve o perfil ativo do usuário.
 *
 * Usa a MESMA regra da fila do SRS (`upcoming-actions.ts`): `activeProfileId`
 * do usuário, senão o perfil marcado como ativo, senão o mais antigo. Antes
 * esta ação olhava só `isActiveProfile`, o que podia reorganizar o perfil
 * errado em relação à fila que ela deveria estar arrumando.
 */
async function getActiveProfileId(userId: string): Promise<string | null> {
  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    include: { profiles: { orderBy: { createdAt: "asc" } } },
  })
  if (!dbUser || dbUser.profiles.length === 0) return null

  const active =
    dbUser.profiles.find((p) => p.id === dbUser.activeProfileId || p.isActiveProfile) ??
    dbUser.profiles[0]

  return active.id
}

/**
 * Reorganiza a fila de estudos: redistribui os cards atrasados a partir de
 * hoje, 5 por dia, com os cards HARD na frente.
 *
 * Só reorganiza cards SEM ciclo ativo (ou com ciclo já encerrado). Card com
 * `ReviewCycle` ACTIVE tem cronograma próprio persistido (`ScheduledReview`) e
 * a data dele é a verdade — reescrever a data quebraria o cronograma do
 * ciclo. Esses cards são preservados e devolvidos em `skippedActiveCycles`.
 */
export async function organizeOverdueCards() {
  await requireActiveSubscriptionForAction()
  const user = await ensureUserExists()

  const profileId = await getActiveProfileId(user.id)
  if (!profileId) {
    throw new Error("Nenhum perfil ativo encontrado")
  }

  const outcome = await reorganizeOverdueCards({ userId: user.id, profileId })

  safeRevalidate([
    "/dashboard/flashcards",
    "/flashcards",
    "/dashboard",
    "/organizar",
    "/gerenciador",
    "/dashboard/configuracoes",
  ])

  return {
    count: outcome.count,
    skippedActiveCycles: outcome.skippedActiveCycles,
  }
}

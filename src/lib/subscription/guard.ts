"use server"

import { redirect } from "next/navigation"
import { ensureUserExists } from "@/lib/auth/sync"
import { prisma } from "@/lib/prisma"

async function resolveActiveUser() {
  const user = await ensureUserExists()

  const sub = await prisma.subscription.findUnique({
    where: { userId: user.id },
  })

  if (!sub) return null

  const hasActiveAccess =
    sub.status === "ACTIVE" ||
    (sub.accessExpiresAt !== null && sub.accessExpiresAt > new Date())

  if (!hasActiveAccess) return null

  return user
}

/**
 * Garante que o usuário autenticado tenha uma assinatura ativa.
 * Usado em Server Components/layouts/páginas: redireciona para a página
 * de upgrade quando não há assinatura ativa, em vez de lançar erro.
 * Retorna o usuário autenticado para uso nas chamadas seguintes.
 */
export async function requireActiveSubscriptionForPage() {
  const user = await resolveActiveUser()
  if (!user) redirect("/dashboard/configuracoes?upgrade=true")

  return user
}

/**
 * Garante que o usuário autenticado tenha uma assinatura ativa.
 * Usado em Server Actions (ex.: geração de IA): lança um erro claro para
 * que a UI possa capturar e exibir a mensagem, em vez de redirecionar.
 * Retorna o usuário autenticado para uso nas chamadas seguintes.
 */
export async function requireActiveSubscriptionForAction() {
  const user = await resolveActiveUser()
  if (!user) {
    throw new Error(
      "Você precisa de uma assinatura ativa para usar esse recurso."
    )
  }

  return user
}

/**
 * Alias de requireActiveSubscriptionForAction, mantido para compatibilidade.
 */
export async function requireActiveSubscription() {
  return requireActiveSubscriptionForAction()
}

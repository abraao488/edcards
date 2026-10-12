import { prisma } from "@/lib/prisma"

/**
 * Controle diário de chamadas à IA (Groq) por usuário.
 *
 * Antes o padrão estava duplicado só dentro de `generateFlashcardsFromText`;
 * agora vive aqui para ser aplicado também em `injectFlashcardsToDatabase`
 * (classificação de cards) e `evaluateAnswerWithAI` (avaliação de resposta).
 *
 * ATENÇÃO: este módulo não pode ter "use server" — os exports virariam
 * server actions públicas.
 */

export const AI_DAILY_LIMIT = 20

export const AI_QUOTA_EXCEEDED_MESSAGE =
  "Você atingiu o limite diário de gerações por IA. Tente novamente amanhã."

/**
 * Lê quantas gerações por IA o usuário já fez hoje, zerando o contador quando
 * o dia virou. Cria o registro de configurações se ainda não existir.
 */
export async function getAiQuotaUsed(userId: string): Promise<number> {
  const now = new Date()
  const startOfToday = new Date(now)
  startOfToday.setHours(0, 0, 0, 0)

  const settings = await prisma.userSettings.upsert({
    where: { userId },
    create: { userId },
    update: {},
  })

  if (settings.aiGenerationsResetAt < startOfToday) {
    await prisma.userSettings.update({
      where: { userId },
      data: { aiGenerationsToday: 0, aiGenerationsResetAt: now },
    })
    return 0
  }

  return settings.aiGenerationsToday
}

/**
 * Consome 1 unidade da cota diária. Usa `updateMany` para não quebrar se o
 * registro não existir mais (nenhuma linha afetada = sem erro).
 */
export async function incrementAiQuota(userId: string): Promise<void> {
  await prisma.userSettings.updateMany({
    where: { userId },
    data: { aiGenerationsToday: { increment: 1 } },
  })
}

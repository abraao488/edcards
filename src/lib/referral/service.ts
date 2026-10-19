import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { recordEvent } from "@/lib/analytics/events"
import { generateReferralCode, normalizeReferralCode } from "./codes"

/** Dias de acesso concedidos por indicação convertida (1 mês). */
export const REFERRAL_REWARD_DAYS = 30

function addDays(base: Date, days: number): Date {
  const d = new Date(base)
  d.setDate(d.getDate() + days)
  return d
}

function maxDate(...dates: (Date | null | undefined)[]): Date {
  const valid = dates.filter((d): d is Date => d instanceof Date)
  return new Date(Math.max(...valid.map((d) => d.getTime())))
}

function isUniqueViolation(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002"
  )
}

/**
 * Garante que o usuário tenha um código de indicação, criando um na primeira
 * chamada. Lida com colisão do índice único tentando novamente.
 */
export async function ensureReferralCode(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { referralCode: true },
  })
  if (user?.referralCode) return user.referralCode

  for (let attempt = 0; attempt < 6; attempt++) {
    const code = generateReferralCode()
    try {
      const updated = await prisma.user.update({
        where: { id: userId },
        data: { referralCode: code },
        select: { referralCode: true },
      })
      return updated.referralCode ?? code
    } catch (err) {
      if (isUniqueViolation(err)) continue
      throw err
    }
  }

  throw new Error("Não foi possível gerar um código de indicação")
}

export type LinkReferralResult =
  | { linked: true }
  | { linked: false; reason: "no_code" | "invalid_code" | "self" | "already" }

/**
 * Vincula o usuário recém-cadastrado ao dono do código de convite. Idempotente:
 * referredUserId é único, então reenvios do cadastro não duplicam a indicação.
 */
export async function linkReferral(
  referredUserId: string,
  rawCode: string | null | undefined
): Promise<LinkReferralResult> {
  const code = normalizeReferralCode(rawCode)
  if (!code) return { linked: false, reason: "no_code" }

  const referrer = await prisma.user.findUnique({
    where: { referralCode: code },
    select: { id: true },
  })
  if (!referrer) return { linked: false, reason: "invalid_code" }
  if (referrer.id === referredUserId) return { linked: false, reason: "self" }

  try {
    await prisma.referral.create({
      data: { referrerId: referrer.id, referredUserId },
    })
  } catch (err) {
    if (isUniqueViolation(err)) return { linked: false, reason: "already" }
    throw err
  }

  await recordEvent("referral_claimed", {
    userId: referredUserId,
    properties: { referrerId: referrer.id },
  })
  return { linked: true }
}

/**
 * Concede a recompensa ao indicador quando o indicado paga. Idempotente:
 * marca o Referral como REWARDED e só então estende o acesso. Nunca revive
 * assinaturas CANCELED (estorno/chargeback) — nesse caso marca como
 * recompensado sem tocar no acesso.
 */
export async function grantReferralReward(
  referredUserId: string
): Promise<{ granted: boolean }> {
  const referral = await prisma.referral.findUnique({
    where: { referredUserId },
  })
  if (!referral || referral.status === "REWARDED") return { granted: false }

  const days = referral.rewardDays

  try {
    const sub = await prisma.subscription.findUnique({
      where: { userId: referral.referrerId },
    })

    if (!sub) {
      await prisma.subscription.create({
        data: {
          userId: referral.referrerId,
          status: "ACTIVE",
          paymentMethod: "referral",
          accessExpiresAt: addDays(new Date(), days),
        },
      })
    } else if (sub.status !== "CANCELED") {
      const now = new Date()
      const base = maxDate(now, sub.accessExpiresAt, sub.nextBillingDate)
      await prisma.subscription.update({
        where: { userId: referral.referrerId },
        data: {
          status: "ACTIVE",
          // Estende o acesso a partir do maior vencimento vigente (ou de hoje).
          accessExpiresAt: addDays(base, days),
          nextBillingDate: sub.nextBillingDate
            ? addDays(sub.nextBillingDate, days)
            : sub.nextBillingDate,
        },
      })
    }

    await prisma.referral.update({
      where: { id: referral.id },
      data: { status: "REWARDED", rewardedAt: new Date() },
    })

    await recordEvent("referral_rewarded", {
      userId: referral.referrerId,
      properties: { referredUserId, days },
    })

    return { granted: true }
  } catch (err) {
    console.error("[referral] grantReferralReward falhou:", err)
    return { granted: false }
  }
}

export interface ReferralSummary {
  total: number
  rewarded: number
  pending: number
  rewardDays: number
  monthsEarned: number
}

export async function getReferralSummary(
  userId: string
): Promise<ReferralSummary> {
  const [total, rewarded] = await Promise.all([
    prisma.referral.count({ where: { referrerId: userId } }),
    prisma.referral.count({
      where: { referrerId: userId, status: "REWARDED" },
    }),
  ])

  return {
    total,
    rewarded,
    pending: total - rewarded,
    rewardDays: REFERRAL_REWARD_DAYS,
    monthsEarned: rewarded,
  }
}

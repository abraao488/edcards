"use server"

import { ensureUserExists } from "@/lib/auth/sync"
import { getSiteOrigin } from "@/lib/site"
import { ensureReferralCode, getReferralSummary, type ReferralSummary } from "./service"

export interface InviteData {
  code: string
  link: string
  summary: ReferralSummary
}

/** Código + link de convite do usuário logado, com as estatísticas. */
export async function getMyInvite(): Promise<InviteData> {
  const user = await ensureUserExists()

  const [code, summary, origin] = await Promise.all([
    ensureReferralCode(user.id),
    getReferralSummary(user.id),
    getSiteOrigin(),
  ])

  return {
    code,
    link: `${origin}/register?ref=${code}`,
    summary,
  }
}

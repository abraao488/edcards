"use server"

import { revalidatePath } from "next/cache"
import { randomBytes } from "crypto"
import { prisma } from "@/lib/prisma"
import { ensureUserExists } from "@/lib/auth/sync"
import { requireActiveSubscriptionForAction } from "@/lib/subscription/guard"
import { recordEvent } from "@/lib/analytics/events"

export interface DeckShareState {
  isPublic: boolean
  shareSlug: string | null
}

function slugify(name: string): string {
  return (name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
}

function randomSuffix(length = 6): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789"
  const bytes = randomBytes(length)
  let out = ""
  for (let i = 0; i < length; i++) {
    out += alphabet[bytes[i] % alphabet.length]
  }
  return out
}

function revalidateSharePaths(shareSlug: string | null | undefined) {
  if (shareSlug) {
    revalidatePath(`/d/${shareSlug}`)
  }
  revalidatePath("/dashboard/flashcards")
}

/**
 * Gera um shareSlug único para o deck. Tenta até 8x com sufixos aleatórios
 * para suportar colisões extremamente raras.
 */
async function ensureUniqueShareSlug(baseName: string): Promise<string> {
  const base = slugify(baseName) || "baralho"

  for (let attempt = 0; attempt < 8; attempt++) {
    const candidate = `${base}-${randomSuffix(6 + Math.min(attempt, 2))}`
    const existing = await prisma.deck.findUnique({
      where: { shareSlug: candidate },
      select: { id: true },
    })
    if (!existing) return candidate
  }

  // Fallback: UUID curto (praticamente impossível de colidir)
  return `${base}-${randomBytes(8).toString("hex")}`
}

export async function setDeckPublic(
  deckId: string,
  isPublic: boolean
): Promise<DeckShareState> {
  await requireActiveSubscriptionForAction()
  const user = await ensureUserExists()

  const deck = await prisma.deck.findFirst({
    where: { id: deckId, userId: user.id },
    select: { id: true, name: true, shareSlug: true },
  })
  if (!deck) throw new Error("Baralho não encontrado")

  if (!isPublic) {
    await prisma.deck.update({
      where: { id: deck.id },
      data: { isPublic: false },
    })
    revalidateSharePaths(deck.shareSlug)
    revalidatePath(`/dashboard/flashcards/${deck.id}`)
    return { isPublic: false, shareSlug: deck.shareSlug }
  }

  const shareSlug = deck.shareSlug ?? (await ensureUniqueShareSlug(deck.name))
  await prisma.deck.update({
    where: { id: deck.id },
    data: {
      isPublic: true,
      shareSlug,
      publishedAt: new Date(),
    },
  })

  await recordEvent("deck_published", {
    userId: user.id,
    properties: { deckId: deck.id },
  })

  revalidateSharePaths(shareSlug)
  revalidatePath(`/dashboard/flashcards/${deck.id}`)
  return { isPublic: true, shareSlug }
}

export async function getDeckShareState(
  deckId: string
): Promise<DeckShareState | null> {
  const user = await ensureUserExists()

  const deck = await prisma.deck.findFirst({
    where: { id: deckId, userId: user.id },
    select: { isPublic: true, shareSlug: true },
  })
  if (!deck) return null
  return { isPublic: deck.isPublic, shareSlug: deck.shareSlug }
}

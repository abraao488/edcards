import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { addDays, startOfDay } from "@/lib/srs-review-utils"

/**
 * Núcleo da reorganização da fila de revisão ("Organizar cards atrasados").
 *
 * NÃO é Server Action: é chamado por `organize-actions.ts` (página
 * `/organizar`) e por `organize.ts` (wrapper legado). As camadas de sessão,
 * assinatura e revalidação ficam nos wrappers.
 *
 * ── Invariantes (a causa raiz dos bugs anteriores) ─────────────────────────
 *
 * 1. A fila do SRS lê `ProgressCard.nextReviewDate` — é o campo da verdade.
 *    `Flashcard.nextReview` é só o ESPELHO denormalizado usado nos contadores
 *    de badge (`/dashboard/flashcards` → dueCount, `/dashboard/configuracoes` →
 *    cardsDue). Escrever só o espelho move o badge e NÃO move a fila: por isso
 *    a versão anterior do `organize.ts` não reorganizava nada de útil.
 *
 * 2. Para card com ciclo ATIVO, `nextReviewDate` NÃO pode ser reescrito: ele
 *    espelha a data da `ScheduledReview` pendente (o cronograma persistido é a
 *    verdade do ciclo — ver `createCycleInternal`, `completeCycleReview`,
 *    `adoptPreScheduledCycle` e `skipFlashcard` em `src/lib/srs.ts`).
 *    Reescrever essa data dessincroniza a fila do cronograma já persistido e
 *    quebra os intervalos do ciclo (HARD = +1, +2, +7, +30, +60, +90 dias).
 *
 * 3. A leitura é paginada por cursor e SEM teto: a versão anterior usava
 *    `take: 200` sem `orderBy`, então cards além dos 200 primeiros nunca eram
 *    reorganizados (e a seleção era não-determinística).
 */

export interface OrganizeOutcome {
  /** Cards efetivamente reprogramados. */
  count: number
  /** Cards atrasados com ciclo ACTIVE — preservados (não podem ser tocados). */
  skippedActiveCycles: number
  /** Dias de agenda usados (1 = só hoje). */
  days: number
}

/** Cards por dia na redistribuição. */
export const CARDS_PER_DAY = 5

/** Página de leitura da fila (paginação por cursor em `id`). */
const READ_PAGE_SIZE = 200

/** Grupos de data por transação de escrita (2 statements por grupo). */
const WRITE_BATCH_SIZE = 100

/** Teto de ids por statement (limite de parâmetros do Postgres). */
const MAX_IDS_PER_STATEMENT = 500

interface EligibleCard {
  id: string
  flashcardId: string
  difficultyStage: string
  nextReviewDate: Date
}

/**
 * Prioridade: HARD primeiro (é o card mais consumido/consumido de energia).
 *
 * `difficultyStage` é uma String livre no schema — a comparação precisa ser
 * explícita: ordenar a string em DESC devolve "MEDIUM" > "HARD" > "EASY", que
 * é exatamente o oposto do pretendido pelo comentário original.
 */
const DIFFICULTY_RANK: Record<string, number> = { HARD: 0, MEDIUM: 1, EASY: 2 }

function difficultyRank(stage: string): number {
  return DIFFICULTY_RANK[stage?.toUpperCase()] ?? DIFFICULTY_RANK.MEDIUM
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size))
  }
  return out
}

/**
 * Lê TODOS os cards atrasados e elegíveis, paginados por cursor em `id`.
 *
 * O cursor é `id` (nunca mutado pela reorganização) — o `nextReviewDate`, que
 * é mutado, fica FORA da ordenação para não invalidar a posição do cursor
 * entre páginas.
 */
async function readEligibleCards(profileId: string, today: Date): Promise<EligibleCard[]> {
  const cards: EligibleCard[] = []
  let cursor: string | undefined

  for (;;) {
    const page = await prisma.progressCard.findMany({
      where: {
        profileId,
        nextReviewDate: { lt: today },
        // NUNCA reorganizar card com ciclo ATIVE: o cronograma persistido
        // (ScheduledReview) é a verdade e `nextReviewDate` deve espelhá-lo.
        reviewCycles: { none: { status: "ACTIVE" } },
      },
      orderBy: { id: "asc" },
      take: READ_PAGE_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        flashcardId: true,
        difficultyStage: true,
        nextReviewDate: true,
      },
    })

    if (page.length === 0) break

    cards.push(...page)

    if (page.length < READ_PAGE_SIZE) break
    cursor = page[page.length - 1].id
  }

  return cards
}

/**
 * Redistribui os cards atrasados de um perfil a partir de hoje, 5 por dia.
 *
 * Só mexe em cards SEM ciclo ativo (ou com ciclo já encerrado). Cards com
 * `ReviewCycle` ACTIVE são preservados — o cronograma do ciclo é a verdade.
 */
export async function reorganizeOverdueCards(params: {
  userId: string
  profileId: string
}): Promise<OrganizeOutcome> {
  const { userId, profileId } = params
  const today = startOfDay(new Date())

  const eligible = await readEligibleCards(profileId, today)

  // Cards atrasados que NÃO podem ser tocados: ciclo em andamento.
  const skippedActiveCycles = await prisma.progressCard.count({
    where: {
      profileId,
      nextReviewDate: { lt: today },
      reviewCycles: { some: { status: "ACTIVE" } },
    },
  })

  if (eligible.length === 0) {
    return { count: 0, skippedActiveCycles, days: 0 }
  }

  // Prioridade: HARD primeiro; dentro da mesma dificuldade, o mais atrasado
  // (data mais antiga) primeiro. `id` desempata para manter o resultado
  // determinístico.
  eligible.sort((a, b) => {
    const byDifficulty = difficultyRank(a.difficultyStage) - difficultyRank(b.difficultyStage)
    if (byDifficulty !== 0) return byDifficulty

    const byDate = a.nextReviewDate.getTime() - b.nextReviewDate.getTime()
    if (byDate !== 0) return byDate

    return a.id.localeCompare(b.id)
  })

  // Plano: 5 cards por dia a partir de hoje.
  interface DateGroup {
    date: Date
    progressCardIds: string[]
    flashcardIds: string[]
  }

  const groups = new Map<number, DateGroup>()
  eligible.forEach((card, index) => {
    const dayOffset = Math.floor(index / CARDS_PER_DAY)
    const date = startOfDay(addDays(today, dayOffset))
    const key = date.getTime()

    let group = groups.get(key)
    if (!group) {
      group = { date, progressCardIds: [], flashcardIds: [] }
      groups.set(key, group)
    }
    group.progressCardIds.push(card.id)
    group.flashcardIds.push(card.flashcardId)
  })

  const orderedGroups = Array.from(groups.values()).sort(
    (a, b) => a.date.getTime() - b.date.getTime()
  )

  // Escrita em lote: um `updateMany` por data alvo (agrupa os ids que
  // caem no mesmo dia) + o espelho `Flashcard.nextReview`, para o badge e a
  // fila não divergirem.
  let count = 0

  for (let i = 0; i < orderedGroups.length; i += WRITE_BATCH_SIZE) {
    const batch = orderedGroups.slice(i, i + WRITE_BATCH_SIZE)

    const ops: Prisma.PrismaPromise<Prisma.BatchPayload>[] = []
    const isProgressCardOp: boolean[] = []

    for (const group of batch) {
      for (const ids of chunk(group.progressCardIds, MAX_IDS_PER_STATEMENT)) {
        ops.push(
          prisma.progressCard.updateMany({
            where: {
              id: { in: ids },
              profileId,
              // Rede de segurança: o card pode ter entrado em ciclo entre a
              // leitura e a escrita (aqui ele é preservado de novo).
              reviewCycles: { none: { status: "ACTIVE" } },
            },
            data: { nextReviewDate: group.date, updatedAt: new Date() },
          })
        )
        isProgressCardOp.push(true)
      }

      for (const ids of chunk(group.flashcardIds, MAX_IDS_PER_STATEMENT)) {
        ops.push(
          prisma.flashcard.updateMany({
            where: { id: { in: ids }, deck: { userId } },
            data: { nextReview: group.date },
          })
        )
        isProgressCardOp.push(false)
      }
    }

    const results = await prisma.$transaction(ops)

    for (let index = 0; index < results.length; index++) {
      if (isProgressCardOp[index]) {
        count += results[index]?.count ?? 0
      }
    }
  }

  return { count, skippedActiveCycles, days: orderedGroups.length }
}

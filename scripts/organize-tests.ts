/**
 * Testes de regressão da reorganização da fila ("Organizar cards atrasados").
 *
 * Uso: npx tsx scripts/organize-tests.ts
 *
 * Roda contra o banco real com usuários descartáveis (removidos no final).
 *
 * O que estes testes travam:
 *  - O1/O7: card SEM ciclo e atrasado é reprogramado e some da fila de atraso.
 *  - O2:     card com ciclo ACTIVE NUNCA é tocado (o cronograma persistido é
 *            a verdade — `nextReviewDate` precisa continuar espelhando a
 *            `ScheduledReview` pendente).
 *  - O3:     card com ciclo já ENCERRADO pode ser reorganizado.
 *  - O4:     `skippedActiveCycles` conta exatamente os cards preservados.
 *  - O5:     paginação — TODOS os cards atrasados são reorganizados
 *            (a versão antiga truncava em `take: 200`).
 *  - O6:     prioridade HARD primeiro.
 *  - O8:     cards de outro usuário não são tocados.
 *  - O9:     a Server Action usa o perfil ativo e devolve as contagens.
 */
import { prisma } from "@/lib/prisma"
import { reorganizeOverdueCards } from "@/lib/flashcards/organize-core"
import { startOfDay, addDays } from "@/lib/srs-review-utils"

const results: Promise<{ name: string; ok: boolean; detail?: string }>[] = []

let testChain: Promise<void> = Promise.resolve()

function test(name: string, fn: () => Promise<void> | void) {
  const p = testChain
    .then(fn)
    .then(
      () => ({ name, ok: true as const }),
      (err: unknown) => ({ name, ok: false as const, detail: (err as Error).message })
    )
  testChain = p.then(() => undefined)
  results.push(p)
}

async function runAll() {
  const resolved = await Promise.all(results)
  for (const r of resolved) {
    console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.detail ? `\n      -> ${r.detail}` : ""}`)
  }
  const failed = resolved.filter((r) => !r.ok).length
  console.log(`\nResultado: ${resolved.length - failed}/${resolved.length} testes passaram.`)
  return failed
}

function eq(actual: unknown, expected: unknown, label: string) {
  const a = actual instanceof Date ? actual.toISOString() : JSON.stringify(actual)
  const e = expected instanceof Date ? expected.toISOString() : JSON.stringify(expected)
  if (a !== e) throw new Error(`${label}: esperado ${e}, obtido ${a}`)
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg)
}

const dateStr = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

const sameDate = (a: Date, b: Date) => dateStr(a) === dateStr(b)

// ----------------------------------------------------------------- sessão
type OrganizeActionsModule = typeof import("@/lib/flashcards/organize-actions")

let organizeOverdueCards: OrganizeActionsModule["organizeOverdueCards"]

/**
 * As Server Actions chamam ensureUserExists(), que depende de cookies do
 * Next (`cookies()`), indisponíveis fora de um request. Injetamos uma sessão
 * equivalente (mesmo usuário criado no banco) via require.cache ANTES de
 * carregar o módulo — o restante dos guards (assinatura + propriedade)
 * continua sendo executado de verdade.
 */
function mockAuthSession(userId: string, email: string) {
  const authFile = require.resolve("@/lib/auth/sync")
  require.cache[authFile] = {
    id: authFile,
    filename: authFile,
    loaded: true,
    exports: { ensureUserExists: async () => ({ id: userId, email }) },
    children: [],
    paths: [],
  } as unknown as NodeModule
}

async function loadServerActions() {
  const mod = await import("@/lib/flashcards/organize-actions")
  organizeOverdueCards = mod.organizeOverdueCards
}

// --------------------------------------------------------------- test world
interface World {
  userId: string
  profileId: string
  deckId: string
  ids: {
    semCiclo: string
    ativo: string
    encerrado: string
    futuro: string
  }
  /** ProgressCard id de cada card. */
  pcIds: {
    semCiclo: string
    ativo: string
    encerrado: string
    futuro: string
  }
}

async function createWorld() {
  const userId = `test-organize-${crypto.randomUUID()}`
  const email = `${userId}@edcards.test`

  const user = await prisma.user.create({
    data: { id: userId, email, settings: { create: { aiEnabled: false } } },
  })

  await prisma.subscription.create({
    data: { userId: user.id, status: "ACTIVE", plan: "INDIVIDUAL" },
  })

  const profile = await prisma.profile.create({
    data: { userId: user.id, name: "Teste Organizar", isActiveProfile: true },
  })

  const subject = await prisma.subject.create({ data: { userId: user.id, name: "Matéria" } })
  const topic = await prisma.topic.create({ data: { subjectId: subject.id, name: "Assunto" } })
  const deck = await prisma.deck.create({ data: { userId: user.id, name: "Deck" } })

  const makeCard = async (front: string) =>
    prisma.flashcard.create({
      data: { deckId: deck.id, front, back: "resposta", topicId: topic.id },
    })

  const yesterday = startOfDay(addDays(new Date(), -1))
  const tenDaysAgo = startOfDay(addDays(new Date(), -10))
  const twentyDaysAgo = startOfDay(addDays(new Date(), -20))
  const tomorrow = startOfDay(addDays(new Date(), 1))

  // --- Card 1: SEM ciclo, atrasado, HARD
  const cardSemCiclo = await makeCard("Sem ciclo")
  const pcSemCiclo = await prisma.progressCard.create({
    data: {
      profileId: profile.id,
      flashcardId: cardSemCiclo.id,
      nextReviewDate: tenDaysAgo,
      difficultyStage: "HARD",
      isCycleEnded: false,
    },
  })

  // --- Card 2: ciclo ACTIVE, revisão pendente VENCIDA (ontem)
  const cardAtivo = await makeCard("Ciclo ativo")
  const pcAtivo = await prisma.progressCard.create({
    data: {
      profileId: profile.id,
      flashcardId: cardAtivo.id,
      nextReviewDate: yesterday,
      difficultyStage: "HARD",
      isCycleEnded: false,
    },
  })
  const cycleAtivo = await prisma.reviewCycle.create({
    data: {
      flashcardId: cardAtivo.id,
      progressCardId: pcAtivo.id,
      profileId: profile.id,
      baseDate: twentyDaysAgo,
      classification: "HARD",
      status: "ACTIVE",
      totalReviews: 3,
      currentReview: 2,
      initialCycleEvaluationCompleted: true,
    },
  })
  await prisma.scheduledReview.createMany({
    data: [
      {
        cycleId: cycleAtivo.id,
        flashcardId: cardAtivo.id,
        order: 1,
        scheduleDate: twentyDaysAgo,
        completedAt: twentyDaysAgo,
      },
      // Pendente e vencida: é a data que nextReviewDate precisa espelhar.
      { cycleId: cycleAtivo.id, flashcardId: cardAtivo.id, order: 2, scheduleDate: yesterday },
      {
        cycleId: cycleAtivo.id,
        flashcardId: cardAtivo.id,
        order: 3,
        scheduleDate: startOfDay(addDays(new Date(), 5)),
        isFinal: true,
      },
    ],
  })

  // --- Card 3: ciclo ENCERRADO (COMPLETED), atrasado
  const cardEncerrado = await makeCard("Ciclo encerrado")
  const pcEncerrado = await prisma.progressCard.create({
    data: {
      profileId: profile.id,
      flashcardId: cardEncerrado.id,
      nextReviewDate: twentyDaysAgo,
      difficultyStage: "EASY",
      isCycleEnded: true,
    },
  })
  const cycleEncerrado = await prisma.reviewCycle.create({
    data: {
      flashcardId: cardEncerrado.id,
      progressCardId: pcEncerrado.id,
      profileId: profile.id,
      baseDate: twentyDaysAgo,
      classification: "EASY",
      status: "COMPLETED",
      totalReviews: 2,
      currentReview: 2,
      initialCycleEvaluationCompleted: true,
    },
  })
  await prisma.scheduledReview.createMany({
    data: [
      {
        cycleId: cycleEncerrado.id,
        flashcardId: cardEncerrado.id,
        order: 1,
        scheduleDate: twentyDaysAgo,
        completedAt: twentyDaysAgo,
      },
      {
        cycleId: cycleEncerrado.id,
        flashcardId: cardEncerrado.id,
        order: 2,
        scheduleDate: yesterday,
        completedAt: yesterday,
        isFinal: true,
      },
    ],
  })

  // --- Card 4: SEM atraso — não pode ser tocado
  const cardFuturo = await makeCard("Futuro")
  const pcFuturo = await prisma.progressCard.create({
    data: {
      profileId: profile.id,
      flashcardId: cardFuturo.id,
      nextReviewDate: tomorrow,
      difficultyStage: "MEDIUM",
      isCycleEnded: false,
    },
  })

  // --- Usuário INVASOR: card atrasado que NÃO pode ser tocado
  const intruderId = `test-organize-${crypto.randomUUID()}`
  const intruder = await prisma.user.create({
    data: { id: intruderId, email: `${intruderId}@edcards.test` },
  })
  const intruderProfile = await prisma.profile.create({
    data: { userId: intruder.id, name: "Invasor", isActiveProfile: true },
  })
  const intruderDeck = await prisma.deck.create({ data: { userId: intruder.id, name: "Deck Invasor" } })
  const intruderCard = await prisma.flashcard.create({
    data: { deckId: intruderDeck.id, front: "Card do invasor", back: "segredo" },
  })
  const intruderPc = await prisma.progressCard.create({
    data: {
      profileId: intruderProfile.id,
      flashcardId: intruderCard.id,
      nextReviewDate: tenDaysAgo,
      difficultyStage: "HARD",
    },
  })

  return {
    userId: user.id,
    profileId: profile.id,
    deckId: deck.id,
    ids: {
      semCiclo: cardSemCiclo.id,
      ativo: cardAtivo.id,
      encerrado: cardEncerrado.id,
      futuro: cardFuturo.id,
    },
    pcIds: {
      semCiclo: pcSemCiclo.id,
      ativo: pcAtivo.id,
      encerrado: pcEncerrado.id,
      futuro: pcFuturo.id,
    },
    intruder: { userId: intruder.id, profileId: intruderProfile.id, pcId: intruderPc.id },
  } satisfies World & { intruder: { userId: string; profileId: string; pcId: string } }
}

// Usuários descartáveis criados durante os testes. São apagados no final,
// MESMO que uma asserção falhe no meio (senão o banco fica com lixo).
const disposableUserIds: string[] = []

async function cleanup(userIds: string[]) {
  for (const id of userIds) {
    await prisma.user.delete({ where: { id } }).catch(() => undefined)
  }
}

// ----------------------------------------------------------------- testes
async function main() {
  const world = await createWorld()
  const today = startOfDay(new Date())

  test("O1: card SEM ciclo e atrasado é reprogramado (nextReviewDate + espelho)", async () => {
    const before = await prisma.progressCard.findUnique({ where: { id: world.pcIds.semCiclo } })
    assert(before!.nextReviewDate < today, "card estava atrasado antes")

    const outcome = await reorganizeOverdueCards({
      userId: world.userId,
      profileId: world.profileId,
    })

    const after = await prisma.progressCard.findUnique({ where: { id: world.pcIds.semCiclo } })
    assert(after!.nextReviewDate >= today, "nextReviewDate foi movido para hoje ou depois")
    eq(dateStr(after!.nextReviewDate), dateStr(today), "card sem ciclo vai para o dia 0 (hoje)")

    // O espelho denormalizado precisa acompanhar, senão o badge mente.
    const flashcard = await prisma.flashcard.findUnique({ where: { id: world.ids.semCiclo } })
    eq(dateStr(flashcard!.nextReview), dateStr(after!.nextReviewDate), "Flashcard.nextReview espelha")

    assert(outcome.count >= 1, "count >= 1")
  })

  test("O2: card com ciclo ACTIVE NÃO é tocado (cronograma permanece sincronizado)", async () => {
    const before = await prisma.progressCard.findUnique({ where: { id: world.pcIds.ativo } })
    const beforeSchedule = await prisma.scheduledReview.findFirst({
      where: { cycle: { progressCardId: world.pcIds.ativo }, completedAt: null },
      orderBy: { order: "asc" },
    })
    assert(!!beforeSchedule, "existe revisão pendente")

    await reorganizeOverdueCards({ userId: world.userId, profileId: world.profileId })

    const after = await prisma.progressCard.findUnique({ where: { id: world.pcIds.ativo } })
    const afterSchedule = await prisma.scheduledReview.findUnique({
      where: { id: beforeSchedule!.id },
    })

    eq(after!.nextReviewDate.toISOString(), before!.nextReviewDate.toISOString(), "nextReviewDate intocado")
    eq(
      afterSchedule!.scheduleDate.toISOString(),
      beforeSchedule!.scheduleDate.toISOString(),
      "ScheduledReview pendente intocada"
    )
    // O invariante do sistema: nextReviewDate espelha a revisão pendente.
    eq(
      after!.nextReviewDate.toISOString(),
      afterSchedule!.scheduleDate.toISOString(),
      "nextReviewDate continua espelhando a revisão pendente"
    )
  })

  test("O3: card com ciclo ENCERRADO pode ser reorganizado", async () => {
    // Reatrasa o card: os testes rodam em sequência e O1 já o reprogramou.
    await prisma.progressCard.update({
      where: { id: world.pcIds.encerrado },
      data: { nextReviewDate: startOfDay(addDays(new Date(), -20)) },
    })

    const before = await prisma.progressCard.findUnique({ where: { id: world.pcIds.encerrado } })
    assert(before!.nextReviewDate < today, "estava atrasado antes")

    await reorganizeOverdueCards({ userId: world.userId, profileId: world.profileId })

    const after = await prisma.progressCard.findUnique({ where: { id: world.pcIds.encerrado } })
    assert(after!.nextReviewDate >= today, "card com ciclo encerrado foi reprogramado")
    // O ciclo encerrado continua encerrado — reorganizar não mexe no estado.
    const cycle = await prisma.reviewCycle.findFirst({
      where: { progressCardId: world.pcIds.encerrado },
    })
    eq(cycle!.status, "COMPLETED", "ciclo continua COMPLETED")
  })

  test("O4: skippedActiveCycles conta os cards preservados", async () => {
    const outcome = await reorganizeOverdueCards({
      userId: world.userId,
      profileId: world.profileId,
    })
    eq(outcome.skippedActiveCycles, 1, "exatamente 1 card com ciclo ativo atrasado")
  })

  test("O5: paginação — TODOS os cards atrasados são reorganizados (sem take: 200)", async () => {
    const bulkUserId = `test-organize-${crypto.randomUUID()}`
    disposableUserIds.push(bulkUserId)
    const user = await prisma.user.create({
      data: { id: bulkUserId, email: `${bulkUserId}@edcards.test` },
    })
    const profile = await prisma.profile.create({
      data: { userId: user.id, name: "Bulk", isActiveProfile: true },
    })
    const deck = await prisma.deck.create({ data: { userId: user.id, name: "Deck Bulk" } })

    const TOTAL = 250 // > 200 (o teto da versão antiga)
    const tenDaysAgo = startOfDay(addDays(new Date(), -10))

    const cards = Array.from({ length: TOTAL }, (_, i) => ({
      id: crypto.randomUUID(),
      deckId: deck.id,
      front: `Bulk ${i}`,
      back: "resposta",
      nextReview: tenDaysAgo,
    }))
    await prisma.flashcard.createMany({ data: cards })

    await prisma.progressCard.createMany({
      data: cards.map((c) => ({
        profileId: profile.id,
        flashcardId: c.id,
        nextReviewDate: tenDaysAgo,
        difficultyStage: "MEDIUM",
      })),
    })

    const outcome = await reorganizeOverdueCards({
      userId: user.id,
      profileId: profile.id,
    })
    eq(outcome.count, TOTAL, `todos os ${TOTAL} cards foram reorganizados`)

    const stillOverdue = await prisma.progressCard.count({
      where: { profileId: profile.id, nextReviewDate: { lt: today } },
    })
    eq(stillOverdue, 0, "nenhum card continua atrasado")

    await cleanup([user.id])
  })

  test("O6: prioridade HARD primeiro", async () => {
    const hardUserId = `test-organize-${crypto.randomUUID()}`
    disposableUserIds.push(hardUserId)
    const user = await prisma.user.create({
      data: { id: hardUserId, email: `${hardUserId}@edcards.test` },
    })
    const profile = await prisma.profile.create({
      data: { userId: user.id, name: "Hard", isActiveProfile: true },
    })
    const deck = await prisma.deck.create({ data: { userId: user.id, name: "Deck Hard" } })

    const tenDaysAgo = startOfDay(addDays(new Date(), -10))
    const mk = async (front: string, stage: string) => {
      const c = await prisma.flashcard.create({
        data: { deckId: deck.id, front, back: "r", nextReview: tenDaysAgo },
      })
      const pc = await prisma.progressCard.create({
        data: {
          profileId: profile.id,
          flashcardId: c.id,
          nextReviewDate: tenDaysAgo,
          difficultyStage: stage,
        },
      })
      return pc.id
    }

    const easyPc = await mk("Easy", "EASY")
    const hardPc = await mk("Hard", "HARD")

    await reorganizeOverdueCards({ userId: user.id, profileId: profile.id })

    const hard = await prisma.progressCard.findUnique({ where: { id: hardPc } })
    const easy = await prisma.progressCard.findUnique({ where: { id: easyPc } })
    eq(dateStr(hard!.nextReviewDate), dateStr(today), "HARD ocupa o dia 0")
    eq(dateStr(easy!.nextReviewDate), dateStr(today), "EASY também entra no dia 0 (5/dia)")
    assert(
      hard!.nextReviewDate.getTime() <= easy!.nextReviewDate.getTime(),
      "HARD nunca é agendado depois do EASY",
    )

    await cleanup([user.id])
  })

  test("O7: fila do SRS para de ver o card como atrasado", async () => {
    const overdue = await prisma.progressCard.count({
      where: {
        profileId: world.profileId,
        nextReviewDate: { lt: today },
        reviewCycles: { some: { status: "ACTIVE" } },
      },
    })
    eq(overdue, 1, "só o card com ciclo ativo continua 'atrasado' (e é o ciclo que manda)")

    const semCiclo = await prisma.progressCard.findUnique({
      where: { id: world.pcIds.semCiclo },
    })
    assert(semCiclo!.nextReviewDate >= today, "card sem ciclo não está mais atrasado")
  })

  test("O8: cards de outro usuário não são tocados", async () => {
    await reorganizeOverdueCards({ userId: world.userId, profileId: world.profileId })

    const intruderPc = await prisma.progressCard.findUnique({ where: { id: world.intruder.pcId } })
    assert(intruderPc!.nextReviewDate < today, "card do invasor continua intocado")
  })

  test("O9: Server Action usa o perfil ativo e devolve as contagens", async () => {
    mockAuthSession(world.userId, `${world.userId}@edcards.test`)
    await loadServerActions()

    const result = await organizeOverdueCards()
    assert(typeof result.count === "number", "count numérico")
    assert(typeof result.skippedActiveCycles === "number", "skippedActiveCycles numérico")
    eq(result.skippedActiveCycles, 1, "1 card com ciclo ativo preservado")
  })

  const failed = await runAll()
  await cleanup([world.userId, world.intruder.userId, ...disposableUserIds])
  process.exit(failed > 0 ? 1 : 0)
}

main().catch(async (err) => {
  console.error("Erro fatal:", err)
  await cleanup(disposableUserIds)
  process.exit(1)
})

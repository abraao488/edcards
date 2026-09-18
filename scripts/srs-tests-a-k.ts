/**
 * Testes A–K do algoritmo de revisões do Edcards.
 * Roda contra o banco real com um usuário descartável (removido no final).
 * Uso: npx tsx scripts/srs-tests-a-k.ts
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { prisma } from "@/lib/prisma"
import {
  classifyAndCreateCycle,
  completeCycleReview,
  renewReviewCycle,
  skipFlashcard,
  submitFirstReview,
  ensureProgressCardsForFlashcards,
} from "@/lib/srs"
import {
  buildReviewSchedule,
  deriveReviewState,
  queueFilterWithoutCompletedOnly,
  startOfDay,
  addDays,
  type ActiveCycleInfo,
} from "@/lib/srs-review-utils"
import { getRevisionCalendarForUser } from "@/lib/dashboard/actions"

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

// ---------------------------------------------------------------- utilitários
const now = () => new Date()

function eq(actual: unknown, expected: unknown, label: string) {
  const a = actual instanceof Date ? actual.toISOString() : JSON.stringify(actual)
  const e = expected instanceof Date ? expected.toISOString() : JSON.stringify(expected)
  if (a !== e) throw new Error(`${label}: esperado ${e}, obtido ${a}`)
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg)
}

function dateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

const sameDate = (a: Date, b: Date) => dateStr(a) === dateStr(b)

// Cria o mundo de teste (user descartável + perfil + subject/topic/deck/cards)
async function createTestWorld() {
  const userId = `test-${crypto.randomUUID()}`
  const email = `${userId}@edcards.test`

  const user = await prisma.user.create({
    data: {
      id: userId,
      email,
      settings: { create: { aiEnabled: false } },
    },
  })

  const profile = await prisma.profile.create({
    data: { userId: user.id, name: "Teste A–K", isActiveProfile: true },
  })

  const subject = await prisma.subject.create({ data: { userId: user.id, name: "Matéria Teste" } })
  const topic = await prisma.topic.create({ data: { subjectId: subject.id, name: "Assunto Teste" } })
  const deck = await prisma.deck.create({ data: { userId: user.id, name: "Deck Teste" } })

  const makeFlashcard = async (front: string, back: string) =>
    prisma.flashcard.create({
      data: {
        deckId: deck.id,
        front,
        back,
        topicId: topic.id,
      },
    })

  const flashcardA = await makeFlashcard("Quem escreveu Dom Casmurro?", "Machado de Assis")
  const flashcardB = await makeFlashcard("Capital do Brasil em 1960?", "Brasília")
  const flashcardC = await makeFlashcard("Fórmula da água?", "H2O")
  const flashcardD = await makeFlashcard("4 + 4 = ?", "8")

  await ensureProgressCardsForFlashcards(profile.id, [
    flashcardA.id,
    flashcardB.id,
    flashcardC.id,
    flashcardD.id,
  ])

  const cards = await prisma.progressCard.findMany({
    where: { profileId: profile.id },
  })
  const byFlashcard = async (flashcardId: string) => {
    const pc = await prisma.progressCard.findFirst({ where: { profileId: profile.id, flashcardId } })
    if (!pc) throw new Error(`ProgressCard não encontrado para flashcard ${flashcardId}`)
    return pc
  }
  const cardA = await byFlashcard(flashcardA.id)
  const cardB = await byFlashcard(flashcardB.id)
  const cardC = await byFlashcard(flashcardC.id)
  const cardD = await byFlashcard(flashcardD.id)
  assert(!!cardA && !!cardB && !!cardC && !!cardD, "4 ProgressCards criadas")

  return {
    prisma,
    userId,
    profileId: profile.id,
    cardA,
    cardB,
    cardC,
    cardD,
    flashcardA,
    flashcardB,
    flashcardC,
    flashcardD,
  }
}

async function cleanup(userId: string) {
  await prisma.user.delete({ where: { id: userId } }).catch(() => undefined)
}

async function writeQueueIncludes(profileId: string, ids: string[]) {
  const inQueue = await prisma.progressCard.findMany({
    where: { profileId, ...queueFilterWithoutCompletedOnly() },
    select: { id: true },
  })
  const set = new Set(inQueue.map((c) => c.id))
  return ids.map((id) => set.has(id))
}

// ----------------------------------------------------------------- testes
async function main() {
  const world = await createTestWorld()

  // ---------- A) Máquina de estados (deriveReviewState) — puro ----------
  test("A: deriveReviewState — transições da máquina de estados", () => {
    const base = now()
    const cycle: ActiveCycleInfo = {
      id: "x",
      classification: "MEDIUM",
      currentReview: 2,
      totalReviews: 5,
      baseDate: base,
      isFinal: false,
    }
    eq(deriveReviewState({}, false), "FIRST_RESOLUTION", "sem firstReviewAt")
    eq(deriveReviewState({ firstReviewAt: base }, false), "AGUARDANDO_AVALIACAO_24H", "2ª resolução")
    eq(deriveReviewState({ firstReviewAt: base, activeCycle: cycle }, false), "CICLO_ATIVO", "ciclo ativo")
    eq(
      deriveReviewState(
        { firstReviewAt: base, activeCycle: { ...cycle, isFinal: true, currentReview: 5 } },
        false
      ),
      "ULTIMA_REVISAO",
      "última revisão"
    )
    eq(
      deriveReviewState({ firstReviewAt: base, hasCompletedCycle: true }, false),
      "CICLO_FINALIZADO",
      "ciclo finalizado -> renovar"
    )
    // Modo consulta contorna TODOS os estados
    eq(deriveReviewState({ firstReviewAt: base, activeCycle: cycle }, true), "CONSULTA", "quiz ativo")
    eq(deriveReviewState({}, true), "CONSULTA", "quiz 1ª resolução")
  })

  // ---------- B) Classificação cria ciclo persistido ----------
  test("B: classifyAndCreateCycle cria ReviewCycle + cronograma persistido", async () => {
    const r = await classifyAndCreateCycle(world.cardB.id, "Brasília", world.userId, "MEDIUM")
    eq(r.classification, "MEDIUM", "classificação")
    eq(r.totalReviews, 5, "total MEDIUM")

    const cycle = await prisma.reviewCycle.findUnique({
      where: { id: r.cycleId },
      include: { scheduledReviews: { orderBy: { order: "asc" } } },
    })
    assert(!!cycle && cycle.status === "ACTIVE", "ciclo deve iniciar ACTIVE")
    const c = cycle!
    assert(c.currentReview === 1, "currentReview deve iniciar 1")
    assert(c.initialCycleEvaluationCompleted === true, "avaliação concluída na criação")
    eq(c.scheduledReviews.length, 5, "revisões criadas")
    eq(c.scheduledReviews[0].order, 1, "primeira order")
    eq(c.scheduledReviews[4].isFinal, true, "isFinal apenas na última")
    for (let i = 0; i < 4; i++) {
      eq(c.scheduledReviews[i].isFinal, false, `order ${i + 1} não final`)
    }

    const pc = await prisma.progressCard.findUnique({ where: { id: world.cardB.id } })
    eq(pc!.hasChosenEvalMode, true, "hasChosenEvalMode")
    eq(pc?.difficultyStage, "MEDIUM", "difficultyStage")
    eq(pc!.currentCycleDay, 1, "currentCycleDay")
    assert(!!pc && sameDate(pc.nextReviewDate, c.scheduledReviews[0]!.scheduleDate), "nextReviewDate = 1ª revisão")
  })

  // ---------- C) Schema de intervalos por classificação ----------
  test("C: buildReviewSchedule — intervalos não cumulativos por dificuldade", () => {
    const base = new Date(2026, 0, 1)
    const easy = buildReviewSchedule("EASY", base)
    const medium = buildReviewSchedule("MEDIUM", base)
    const hard = buildReviewSchedule("HARD", base)
    eq(easy.length, 4, "EASY=4")
    eq(medium.length, 5, "MEDIUM=5")
    eq(hard.length, 6, "HARD=6")
    eq(medium[1].isFinal, false, "MEDIUM meio não final")
    eq(medium[4].isFinal, true, "MEDIUM última final")

    const checkIntervals = (plan: { scheduleDate: Date; isFinal: boolean }[], days: number[], label: string) => {
      plan.forEach((s, i) => {
        const expected = addDays(base, days[i])
        assert(sameDate(s.scheduleDate, expected), `${label} intervalo ${i}: ${dateStr(s.scheduleDate)} != ${dateStr(expected)}`)
      })
    }
    checkIntervals(easy, [14, 30, 60, 90], "EASY")
    checkIntervals(medium, [7, 21, 30, 60, 90], "MEDIUM")
    checkIntervals(hard, [1, 2, 7, 30, 60, 90], "HARD")
  })

  // ---------- D) Exemplo canônico 01/01/2026 + HARD ----------
  test("D: cronograma HARD a partir de 01/01/2026 (exemplo canônico)", () => {
    const plan = buildReviewSchedule("HARD", new Date(2026, 0, 1))
    const expected = ["2026-01-02", "2026-01-03", "2026-01-08", "2026-01-31", "2026-03-02", "2026-04-01"]
    eq(plan.map((s) => dateStr(s.scheduleDate)), expected, "datas")
    eq(plan[5].isFinal, true, "final na 6ª")
  })

  // ---------- E) Avanço no meio do ciclo (não reclassifica) ----------
  test("E: completeCycleReview avança currentReview e marca a revisão feita", async () => {
    const r = await completeCycleReview(world.cardB.id, "Brasília", world.userId)
    eq(r.currentReview, 2, "próxima revisão = 2")
    eq(r.isFinal, false, "não é final")

    const cycle = await prisma.reviewCycle.findFirst({
      where: { progressCardId: world.cardB.id, status: "ACTIVE" },
      include: { scheduledReviews: { orderBy: { order: "asc" } } },
    })
    assert(!!cycle && cycle.currentReview === 2, "cycle.currentReview=2")
    assert(!!cycle && cycle.scheduledReviews[0].completedAt !== null, "order1 concluída")
    assert(!!cycle && cycle.scheduledReviews[1].completedAt === null, "order2 pendente")
    assert(!!cycle && sameDate(cycle.scheduledReviews[1].scheduleDate, r.nextReviewDate), "nextReview=order2")
    assert(!!cycle && cycle.scheduledReviews[2].completedAt === null, "order3 ainda pendente (congelado)")

    const pc = await prisma.progressCard.findUnique({ where: { id: world.cardB.id } })
    eq(pc?.currentCycleDay, 2, "progressCard.currentCycleDay=2")
  })

  // ---------- F) Fim do ciclo sem renovação ----------
  test("F: completar todas as revisões finaliza o ciclo (COMPLETED)", async () => {
    await classifyAndCreateCycle(world.cardC.id, "H2O", world.userId, "HARD")
    const total = 6 // HARD
    for (let i = 0; i < total - 1; i++) {
      const r = await completeCycleReview(world.cardC.id, "H2O", world.userId)
      eq(r.isFinal, false, `revisão ${i + 1} de ${total} não final`)
    }
    const last = await completeCycleReview(world.cardC.id, "H2O", world.userId)
    eq(last.isFinal, true, "última revisão final")
    eq(last.isCycleCompleted, true, "ciclo completo")

    const cycle = await prisma.reviewCycle.findFirst({
      where: { progressCardId: world.cardC.id },
      orderBy: { createdAt: "desc" },
      include: { scheduledReviews: { orderBy: { order: "asc" } } },
    })
    eq(cycle?.status, "COMPLETED", "ciclo COMPLETED")
    assert(!!cycle && cycle.scheduledReviews.every((s) => s.completedAt !== null), "todas concluídas")

    const pc = await prisma.progressCard.findUnique({ where: { id: world.cardC.id } })
    eq(pc?.isCycleEnded, true, "isCycleEnded")

    const inQueue = await writeQueueIncludes(world.profileId, [world.cardA.id, world.cardB.id, world.cardC.id, world.cardD.id])
    eq(inQueue[2], false, "cardC finalizado sai da fila (completed-only)")
  })

  // ---------- G) Renovação re-classifica e preserva histórico ----------
  test("G: renewReviewCycle gera novo ciclo, preserva o anterior", async () => {
    const r = await renewReviewCycle(world.cardC.id, "H2O", world.userId, "HARD")
    eq(r.classification, "HARD", "nova classificação")
    eq(r.totalReviews, 6, "novo ciclo HARD=6")

    const cycles = await prisma.reviewCycle.findMany({
      where: { progressCardId: world.cardC.id },
      orderBy: { createdAt: "asc" },
    })
    eq(cycles.length, 2, "histórico preservado (COMPLETED + ACTIVE)")
    eq(cycles[0].status, "COMPLETED", "anterior COMPLETED")
    eq(cycles[1].status, "ACTIVE", "novo ACTIVE")

    const inQueue = await writeQueueIncludes(world.profileId, [world.cardC.id])
    eq(inQueue[0], true, "cardC volta à fila com ciclo ativo")
  })

  // ---------- H) Skip dentro do ciclo move a pendente para amanhã ----------
  test("H: skipFlashcard move progressCard e a ScheduledReview pendente para amanhã", async () => {
    const before = await prisma.reviewCycle.findFirst({
      where: { progressCardId: world.cardB.id, status: "ACTIVE" },
      include: { scheduledReviews: { where: { completedAt: null }, orderBy: { order: "asc" } } },
    })
    const pendingBefore = before?.scheduledReviews[0]
    assert(!!pendingBefore, "deve existir revisão pendente")

    await skipFlashcard(world.cardB.id)

    const tomorrow = addDays(new Date(), 1)
    const afterCycle = await prisma.reviewCycle.findFirst({
      where: { progressCardId: world.cardB.id, status: "ACTIVE" },
      include: { scheduledReviews: { where: { id: pendingBefore!.id } } },
    })
    assert(!!afterCycle?.scheduledReviews[0], "revisão pendente ainda existe")
    assert(
      sameDate(afterCycle!.scheduledReviews[0]!.scheduleDate, tomorrow),
      "pendente movida para amanhã"
    )
    const pc = await prisma.progressCard.findUnique({ where: { id: world.cardB.id } })
    assert(!!pc && sameDate(pc.nextReviewDate, tomorrow), "nextReviewDate para amanhã")
  })

  // ---------- I) Filtro de fila (queueFilterWithoutCompletedOnly) ----------
  test("I: fila mantém 1ª/2ª resolução e ciclo ativo; exclui completed-only", async () => {
    const inQueue = await writeQueueIncludes(world.profileId, [world.cardA.id, world.cardB.id, world.cardC.id, world.cardD.id])
    eq(inQueue, [true, true, true, true], "cardA(1ª), cardB(ativo), cardC(renovado), cardD(1ª) na fila")

    // cardD completa o ciclo EASY inteiro -> deve sair da fila
    await classifyAndCreateCycle(world.cardD.id, "8", world.userId, "EASY")
    for (let i = 0; i < 3; i++) {
      await completeCycleReview(world.cardD.id, "8", world.userId)
    }
    const done = await completeCycleReview(world.cardD.id, "8", world.userId)
    eq(done.isCycleCompleted, true, "cardD ciclo completo")

    const after = await writeQueueIncludes(world.profileId, [world.cardA.id, world.cardB.id, world.cardC.id, world.cardD.id])
    eq(after, [true, true, true, false], "cardD finalizado excluído da fila")

    eq(deriveReviewState({ firstReviewAt: new Date(), hasCompletedCycle: true }, false), "CICLO_FINALIZADO", "estado de renovação p/ cardD")
  })

  // ---------- J) Calendário: union + isFinal ----------
  test("J: getRevisionCalendarForUser mostra revisões agendadas + isFinal", async () => {
    const days = 400
    const today = startOfDay(new Date())
    const endDate = addDays(today, days)

    const schedRows = await prisma.scheduledReview.findMany({
      where: {
        scheduleDate: { gte: today, lte: endDate },
        cycle: { status: "ACTIVE", progressCard: { profileId: world.profileId } },
      },
      select: { scheduleDate: true, isFinal: true },
    })
    const expectedKeys = new Set(schedRows.map((s) => dateStr(s.scheduleDate)))

    const calendar = await getRevisionCalendarForUser(world.userId, days)

    // Todas as revisões futuras do cronograma completo estão no calendário
    for (const key of Array.from(expectedKeys)) {
      assert(!!calendar[key], `data ${key} presente no calendário`)
    }

    // Todo dia exibido para o ciclo ativo corresponde a uma ScheduledReview
    const cycleKeys = new Set()
    for (const [k, entries] of Object.entries(calendar)) {
      for (const e of entries) {
        if (e.isFinal === true) cycleKeys.add(k)
      }
    }
    const finalRows = schedRows.filter((s) => s.isFinal).map((s) => dateStr(s.scheduleDate))
    eq(Array.from(cycleKeys).sort(), Array.from(new Set(finalRows)).sort(), "isFinal apenas nas datas finais (vermelho)")

    // cardA (1ª resolução, sem ciclo) aparece pelo nextReviewDate
    const cardAKey = dateStr((await prisma.progressCard.findUnique({ where: { id: world.cardA.id } }))!.nextReviewDate)
    const hasA = (calendar[cardAKey] ?? []).some((e) => e.deckName === "Deck Teste")
    assert(hasA, "card de 1ª resolução aparece via nextReviewDate (branch sem ciclo)")
  })

  // ---------- K) Guarda do Modo Consulta (isQuizMode) ----------
  test("K: Modo Consulta não escreve — guards isQuizMode preservados", () => {
    const file = resolve(process.cwd(), "src/components/srs-review-session.tsx")
    const src = readFileSync(file, "utf-8")

    const guards = (src.match(/isQuizMode/g) ?? []).length
    assert(guards >= 13, `esperado >= 13 refs isQuizMode, obtido ${guards}`)

    assert(!src.includes("submitSRSReview"), "submitSRSReview removido")
    assert(!src.includes("resetSRSProgressCycle"), "resetSRSProgressCycle removido")
    assert(src.includes("classifyAndCreateCycle"), "usa classifyAndCreateCycle")
    assert(src.includes("completeCycleReview"), "usa completeCycleReview")
    assert(src.includes("renewReviewCycle"), "usa renewReviewCycle")
    assert(src.includes("deriveReviewState"), "usa deriveReviewState")

    // Comportamental: qualquer entrada + isQuizMode=true => CONSULTA (nenhuma escrita)
    eq(
      deriveReviewState(
        { firstReviewAt: new Date(), activeCycle: { id: "x", classification: "HARD", currentReview: 6, totalReviews: 6, baseDate: new Date(), isFinal: true } },
        true
      ),
      "CONSULTA",
      "quiz ignora até a última revisão"
    )
  })

  // ------------------------------------------------- query the results
  const failed = await runAll()
  await cleanup(world.userId)
  await prisma.$disconnect()
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error("Falha crítica no harness:", err)
  process.exit(1)
})
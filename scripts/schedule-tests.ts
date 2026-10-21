/**
 * Testes end-to-end do cronograma reverso (Edital Fechado).
 *
 * Roda contra o banco real com um usuário descartável (removido no final).
 * Uso: npx tsx scripts/schedule-tests.ts
 *
 * As Server Actions de src/lib/schedule/actions.ts exigem sessão autenticada
 * (ensureUserExists) e assinatura ativa (requireActiveSubscriptionForAction).
 * Fora de um request do Next não existe cookie de sessão, então este harness
 * injeta um ensureUserExists falso via require.cache ANTES de importar
 * @/lib/schedule/actions — os guards de assinatura e de propriedade rodam de
 * verdade, contra o banco.
 */
import { prisma } from "@/lib/prisma"
import { addDays, startOfDay } from "@/lib/schedule/plan"

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

function dateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

type ScheduleModule = typeof import("@/lib/schedule/actions")
let scheduleModule: ScheduleModule

// Usuário "logado" do harness. Trocável em tempo de execução para testar
// mais de um usuário sem recarregar o módulo (o import já é live).
let currentUserId = ""
let currentEmail = ""

function mockAuthSession(userId: string, email: string) {
  currentUserId = userId
  currentEmail = email
  const authFile = require.resolve("@/lib/auth/sync")
  require.cache[authFile] = {
    id: authFile,
    filename: authFile,
    loaded: true,
    exports: {
      ensureUserExists: async () => ({ id: currentUserId, email: currentEmail }),
    },
    children: [],
    paths: [],
  } as unknown as NodeModule
}

function setSession(userId: string, email: string) {
  currentUserId = userId
  currentEmail = email
}

// Usuários descartáveis criados nesta execução — removidos no `finally`,
// mesmo que um teste falhe (nada de lixo no banco de produção).
const createdUserIds: string[] = []

async function createTestWorld(topicCount: number) {
  const userId = `test-${crypto.randomUUID()}`
  const email = `${userId}@edcards.test`
  createdUserIds.push(userId)

  const user = await prisma.user.create({
    data: { id: userId, email, settings: { create: { aiEnabled: false } } },
  })

  await prisma.subscription.create({
    data: { userId: user.id, status: "ACTIVE", plan: "INDIVIDUAL" },
  })

  const subject = await prisma.subject.create({
    data: { userId: user.id, name: "Matéria Cronograma" },
  })

  const topicIds: string[] = []
  for (let i = 0; i < topicCount; i++) {
    const topic = await prisma.topic.create({
      data: { subjectId: subject.id, name: `Assunto ${i + 1}`, order: i },
    })
    topicIds.push(topic.id)
  }

  return { userId, email, topicIds }
}

async function cleanup(userId: string) {
  await prisma.user.delete({ where: { id: userId } }).catch(() => undefined)
}

async function cleanupAll() {
  for (const id of createdUserIds) {
    await cleanup(id)
  }
  createdUserIds.length = 0
}

async function main() {
  const world = await createTestWorld(5)
  mockAuthSession(world.userId, world.email)
  scheduleModule = await import("@/lib/schedule/actions")
  const { generateReverseSchedule, getScheduleWithDetails } = scheduleModule

  const today = startOfDay(new Date())

  // -------------------------------------------------------------- S1: básico
  let generated: Awaited<ReturnType<typeof generateReverseSchedule>> | null = null

  await test("S1: 5 assuntos, 40 dias até a prova, 7 de revisão final", async () => {
    const examDate = addDays(today, 40)
    generated = await generateReverseSchedule(examDate, 7)
    assert(!!generated, "cronograma gerado")

    const studyDays = 40 - 7
    const totalDays = studyDays + 7

    // 5 assuntos: 5 dias de estudo, 28 revisões intermediárias, 7 finais
    eq(generated!.totalItems, 40, "total de itens")
    eq(Object.keys(generated!.groupedByDay).length, totalDays, "dias com conteúdo")

    // nenhum dia vazio entre hoje e a véspera da prova
    const keys = Object.keys(generated!.groupedByDay).sort()
    eq(keys[0], dateStr(today), "primeiro dia = hoje")
    eq(keys[keys.length - 1], dateStr(addDays(today, totalDays - 1)), "último dia = véspera da prova")
    for (let d = 0; d < totalDays; d++) {
      const key = dateStr(addDays(today, d))
      const items = generated!.groupedByDay[key] ?? []
      assert(items.length > 0, `dia ${d} (${key}) está vazio no cronograma`)
    }

    // os 7 dias finais têm item e são marcados como FINAL_REVIEW
    for (let d = studyDays; d < totalDays; d++) {
      const key = dateStr(addDays(today, d))
      const items = generated!.groupedByDay[key] ?? []
      eq(items.length, 1, `dia final ${d} (${key}) tem 1 item`)
      assert(
        items.every((item) => item.phase === "FINAL_REVIEW"),
        `dia final ${d} não foi classificado como FINAL_REVIEW`
      )
      assert(
        items.every((item) => item.kind === "REVIEW"),
        `dia final ${d} não foi classificado como REVIEW`
      )
    }

    // cada assunto é estudado exatamente uma vez
    const studyItems = generated!.items.filter((item) => item.phase === "STUDY")
    eq(studyItems.length, 5, "itens de estudo")
    eq(new Set(studyItems.map((item) => item.topicId)).size, 5, "assuntos distintos no estudo")

    // os assuntos estão espalhados (não só nos primeiros dias)
    const studyDaysUsed = studyItems.map((item) => dateStr(item.scheduledFor)).sort()
    eq(studyDaysUsed[0], dateStr(today), "primeiro estudo hoje")
    assert(
      studyDaysUsed[4]! > dateStr(addDays(today, 20)),
      `estudo não foi espalhado (último estudo em ${studyDaysUsed[4]})`
    )

    // a revisão final cobre todos os assuntos
    const finalItems = generated!.items.filter((item) => item.phase === "FINAL_REVIEW")
    eq(new Set(finalItems.map((item) => item.topicId)).size, 5, "revisão final cobre todos os assuntos")
  })

  // ------------------------------------------- S2: re-gerar substitui o plano
  await test("S2: re-gerar apaga o cronograma anterior (sem duplicar)", async () => {
    const examDate = addDays(today, 40)
    const again = await generateReverseSchedule(examDate, 7)
    assert(!!again, "cronograma re-gerado")
    eq(again!.totalItems, 40, "total de itens do novo cronograma")

    const schedules = await prisma.studySchedule.findMany({
      where: { userId: world.userId },
    })
    eq(schedules.length, 1, "apenas um cronograma persistido")

    const persisted = await prisma.scheduleItem.count({
      where: { scheduleId: schedules[0]!.id },
    })
    eq(persisted, 40, "itens persistidos no banco")
  })

  // ------------------------------------------- S3: dias de revisão final > 0
  await test("S3: reviewDays = 0 é rejeitado com mensagem clara", async () => {
    let message = ""
    try {
      await generateReverseSchedule(addDays(today, 40), 0)
    } catch (err) {
      message = (err as Error).message
    }
    assert(message.includes("revisão final"), `mensagem inesperada: ${message}`)
  })

  await test("S4: data da prova próxima demais é rejeitada", async () => {
    let message = ""
    try {
      await generateReverseSchedule(addDays(today, 3), 7)
    } catch (err) {
      message = (err as Error).message
    }
    assert(message.includes("muito próxima"), `mensagem inesperada: ${message}`)
  })

  // ------------------------------ S5: muitos assuntos, poucos dias de estudo
  await test("S5: 30 assuntos em 20 dias — todos os dias de estudo têm item", async () => {
    const world2 = await createTestWorld(30)
    setSession(world2.userId, world2.email)
    const examDate = addDays(today, 20)
    const result = await generateReverseSchedule(examDate, 5)
    assert(!!result, "cronograma gerado")

    const studyDays = 15
    const totalDays = studyDays + 5
    eq(result!.totalItems, 60, "30 de estudo + 30 de revisão final")
    eq(Object.keys(result!.groupedByDay).length, totalDays, "dias com conteúdo")

    const studyItems = result!.items.filter((item) => item.phase === "STUDY")
    eq(studyItems.length, 30, "itens de estudo")
    for (let d = 0; d < studyDays; d++) {
      const items = result!.groupedByDay[dateStr(addDays(today, d))] ?? []
      eq(items.length, 2, `dia de estudo ${d} tem 2 itens`)
    }
    for (let d = studyDays; d < totalDays; d++) {
      const items = result!.groupedByDay[dateStr(addDays(today, d))] ?? []
      eq(items.length, 6, `dia de revisão final ${d} tem 6 itens`)
      assert(
        items.every((item) => item.phase === "FINAL_REVIEW"),
        `dia ${d} não é FINAL_REVIEW`
      )
    }
    await cleanup(world2.userId)
  })

  // --------------------------------------------- S6: propriedade entre usuários
  await test("S6: o cronograma de outro usuário não é tocado", async () => {
    const other = await createTestWorld(3)
    const otherSchedule = await prisma.studySchedule.create({
      data: {
        userId: other.userId,
        examDate: addDays(today, 30),
        totalDays: 20,
        startDate: today,
      },
    })
    await prisma.scheduleItem.create({
      data: { scheduleId: otherSchedule.id, scheduledFor: today },
    })

    setSession(world.userId, world.email)
    await generateReverseSchedule(addDays(today, 40), 7)
    const otherItems = await prisma.scheduleItem.count({
      where: { scheduleId: otherSchedule.id },
    })
    eq(otherItems, 1, "itens do outro usuário intactos")
    const otherScheduleStill = await prisma.studySchedule.findUnique({
      where: { id: otherSchedule.id },
    })
    assert(!!otherScheduleStill, "cronograma do outro usuário continua existindo")
    await cleanup(other.userId)
  })

  // ----------------------------------------- S7: recarga do plano salvo
  await test("S7: getScheduleWithDetails devolve o plano salvo (carga da página)", async () => {
    // Mesmo fluxo da página /edital: acha o cronograma do usuário e carrega.
    const savedSchedule = await prisma.studySchedule.findFirst({
      where: { userId: world.userId },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    })
    assert(!!savedSchedule, "cronograma salvo existe no banco")

    const saved = await getScheduleWithDetails(savedSchedule!.id)
    assert(!!saved, "cronograma salvo encontrado")
    eq(saved!.totalItems, 40, "itens do cronograma salvo")
    eq(saved!.scheduleId, savedSchedule!.id, "mesmo cronograma")

    const totalDays = 40
    eq(
      Object.keys(saved!.groupedByDay).length,
      totalDays,
      "dias com conteúdo no cronograma salvo"
    )
    for (let d = 0; d < totalDays; d++) {
      const items = saved!.groupedByDay[dateStr(addDays(today, d))] ?? []
      assert(items.length > 0, `dia ${d} está vazio no cronograma salvo`)
    }
    // a fase sobrevive à ida e volta ao banco
    const finalItems = saved!.items.filter((item) => item.phase === "FINAL_REVIEW")
    eq(finalItems.length, 7, "itens de revisão final")
    const studyItems = saved!.items.filter((item) => item.phase === "STUDY")
    eq(studyItems.length, 5, "itens de estudo")
    assert(
      saved!.items.every((item) => item.topic !== null && item.subject !== null),
      "itens vêm com assunto e matéria"
    )
    // o assunto continua sendo a 1ª ocorrência = estudo
    eq(
      new Set(studyItems.map((item) => item.topicId)).size,
      5,
      "assuntos distintos no estudo"
    )
  })

  const failed = await runAll()
  await cleanupAll()
  await prisma.$disconnect()
  process.exit(failed > 0 ? 1 : 0)
}

main()
  .catch(async (err) => {
    console.error("Falha crítica no harness:", err)
    await cleanupAll()
    await prisma.$disconnect()
    process.exit(1)
  })

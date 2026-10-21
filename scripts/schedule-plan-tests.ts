/**
 * Testes da política do cronograma reverso (Edital Fechado).
 *
 * São PUROS: não tocam no banco e não dependem de data do "agora". Rodam com:
 *
 *   npx tsx scripts/schedule-plan-tests.ts
 *
 * Cobrem os invariantes prometidos ao usuário:
 *  1. nenhum dia do plano fica vazio (de hoje até a véspera da prova);
 *  2. todo assunto é estudado exatamente uma vez;
 *  3. todo assunto é revisado na fase de revisão final;
 *  4. a revisão intermediária só revisa o que já foi estudado;
 *  5. com poucos assuntos, eles ficam espalhados por todo o período;
 *  6. a classificação (ESTUDO x REVISÃO) bate com o plano.
 */

import {
  addDays,
  buildStudyPlan,
  classifyScheduleItems,
  formatDateKeyPtBr,
  startOfDay,
  toDateKey,
  type SchedulePhase,
} from "../src/lib/schedule/plan"

let passed = 0
let failed = 0

function check(condition: boolean, label: string) {
  if (condition) {
    passed++
  } else {
    failed++
    console.error(`  ✗ ${label}`)
  }
}

function eq(actual: unknown, expected: unknown, label: string) {
  check(
    actual === expected,
    `${label} (esperado: ${String(expected)}, obtido: ${String(actual)})`
  )
}

interface Scenario {
  topics: number
  studyDays: number
  reviewDays: number
}

const SCENARIOS: Scenario[] = [
  { topics: 1, studyDays: 1, reviewDays: 1 },
  { topics: 1, studyDays: 5, reviewDays: 3 },
  { topics: 3, studyDays: 2, reviewDays: 1 },
  { topics: 5, studyDays: 60, reviewDays: 7 },
  { topics: 8, studyDays: 8, reviewDays: 4 },
  { topics: 12, studyDays: 30, reviewDays: 7 },
  { topics: 30, studyDays: 20, reviewDays: 5 },
  { topics: 40, studyDays: 100, reviewDays: 30 },
  { topics: 100, studyDays: 60, reviewDays: 7 },
  { topics: 200, studyDays: 3, reviewDays: 1 },
  { topics: 7, studyDays: 7, reviewDays: 21 },
]

function testScenario(scenario: Scenario) {
  const { topics: total, studyDays, reviewDays } = scenario
  const label = `N=${total} D=${studyDays} R=${reviewDays}`

  const plan = buildStudyPlan(
    Array.from({ length: total }, (_, i) => i),
    studyDays,
    reviewDays
  )

  const totalDays = studyDays + reviewDays

  // --- 1. nenhum dia vazio -------------------------------------------------
  const perDay = new Array<number>(totalDays).fill(0)
  for (const item of plan) {
    check(
      item.dayIndex >= 0 && item.dayIndex < totalDays,
      `${label}: dia fora da janela (${item.dayIndex})`
    )
    perDay[item.dayIndex] = (perDay[item.dayIndex] ?? 0) + 1
  }
  const emptyDays = perDay.filter((count) => count === 0).length
  eq(emptyDays, 0, `${label}: dias sem nenhum item`)

  // --- 2. todo assunto estudado exatamente uma vez -------------------------
  const studyItems = plan.filter((item) => item.phase === "STUDY")
  eq(studyItems.length, total, `${label}: quantidade de itens de estudo`)
  eq(
    new Set(studyItems.map((item) => item.topic)).size,
    total,
    `${label}: assuntos distintos na fase de estudo`
  )

  // --- 3. todo assunto revisado na fase final -----------------------------
  const finalItems = plan.filter((item) => item.phase === "FINAL_REVIEW")
  eq(
    new Set(finalItems.map((item) => item.topic)).size,
    total,
    `${label}: assuntos cobertos pela revisão final`
  )
  check(
    finalItems.every((item) => item.dayIndex >= studyDays),
    `${label}: revisão final dentro da janela final`
  )
  check(
    finalItems.every((item) => item.dayIndex < totalDays),
    `${label}: revisão final antes do dia da prova`
  )
  // todos os dias da janela final têm item
  for (let d = studyDays; d < totalDays; d++) {
    check(
      perDay[d]! > 0,
      `${label}: dia ${d} da janela final está vazio`
    )
  }

  // --- 4. revisão intermediária só revisa o que já caiu ---------------------
  const firstStudyDay = new Map<number, number>()
  for (const item of studyItems) {
    firstStudyDay.set(item.topic, item.dayIndex)
  }
  const intermediate = plan.filter((item) => item.phase === "INTERMEDIATE_REVIEW")
  check(
    intermediate.every(
      (item) => (firstStudyDay.get(item.topic) ?? Infinity) < item.dayIndex
    ),
    `${label}: revisão intermediária de assunto ainda não estudado`
  )
  // dias de estudo sem assunto novo são exatamente os dias de revisão intermediária
  const studyDaysWithNewTopic = new Set(studyItems.map((item) => item.dayIndex))
  const intermediateDays = new Set(intermediate.map((item) => item.dayIndex))
  for (let d = 0; d < studyDays; d++) {
    eq(
      intermediateDays.has(d),
      !studyDaysWithNewTopic.has(d),
      `${label}: dia ${d} de estudo sem assunto novo deveria ter revisão`
    )
  }

  // --- 5. com poucos assuntos, o estudo fica espalhado ---------------------
  if (total < studyDays) {
    const studyDayList = studyItems.map((item) => item.dayIndex).sort((a, b) => a - b)
    const lastStudyDay = studyDayList[studyDayList.length - 1]!
    check(
      lastStudyDay >= studyDays - Math.ceil(studyDays / total),
      `${label}: estudo não chegou ao fim do período (último dia ${lastStudyDay})`
    )
    const maxGap = studyDayList.reduce(
      (max, day, index) =>
        index === 0 ? max : Math.max(max, day - studyDayList[index - 1]!),
      0
    )
    check(
      maxGap <= Math.ceil(studyDays / total) + 1,
      `${label}: assuntos mal distribuídos (maior intervalo ${maxGap})`
    )
  } else {
    // com assuntos >= dias, todo dia de estudo tem assunto e a carga difere em <= 1
    const studyCounts = new Array<number>(studyDays).fill(0)
    for (const item of studyItems) {
      studyCounts[item.dayIndex] = (studyCounts[item.dayIndex] ?? 0) + 1
    }
    eq(
      studyCounts.filter((count) => count === 0).length,
      0,
      `${label}: dia de estudo vazio com assuntos >= dias`
    )
    const max = Math.max(...studyCounts)
    const min = Math.min(...studyCounts)
    check(
      max - min <= 1,
      `${label}: carga de estudo desbalanceada (min ${min}, max ${max})`
    )
  }

  // --- carga da revisão final balanceada quando há material suficiente -----
  if (total >= reviewDays) {
    const finalCounts = new Array<number>(reviewDays).fill(0)
    for (const item of finalItems) {
      finalCounts[item.dayIndex - studyDays] = (finalCounts[item.dayIndex - studyDays] ?? 0) + 1
    }
    const max = Math.max(...finalCounts)
    const min = Math.min(...finalCounts)
    check(
      max - min <= 1,
      `${label}: carga da revisão final desbalanceada (min ${min}, max ${max})`
    )
    eq(
      new Set(finalItems.map((item) => item.topic)).size,
      finalItems.length,
      `${label}: assunto repetido na revisão final`
    )
  }
}

function testClassification() {
  const label = "classificação"
  const total = 5
  const studyDays = 12
  const reviewDays = 3
  const plan = buildStudyPlan(
    Array.from({ length: total }, (_, i) => i),
    studyDays,
    reviewDays
  )

  const start = startOfDay(new Date(2026, 9, 20))
  const persisted = plan.map((item, index) => ({
    id: `item-${index}`,
    topicId: String(item.topic),
    scheduledFor: addDays(start, item.dayIndex),
    phase: item.phase,
  }))

  const classified = classifyScheduleItems(persisted, {
    startDate: start,
    studyDays,
  })

  // primeira ocorrência do assunto = ESTUDO; seguintes = REVISÃO
  const firstOf = new Map<string, number>()
  for (const item of classified) {
    const key = item.topicId!
    if (!firstOf.has(key)) {
      firstOf.set(key, item.kind === "STUDY" ? 1 : 0)
    }
  }
  eq(
    Array.from(firstOf.values()).filter((v) => v === 1).length,
    total,
    `${label}: assuntos classificados como estudo`
  )

  // todos os itens da janela final são FINAL_REVIEW
  const finalStart = addDays(start, studyDays)
  const finalItems = classified.filter(
    (item) => item.scheduledFor.getTime() >= finalStart.getTime()
  )
  eq(finalItems.length, plan.filter((i) => i.phase === "FINAL_REVIEW").length, `${label}: itens da janela final`)
  check(
    finalItems.every((item) => item.phase === "FINAL_REVIEW"),
    `${label}: item da janela final não marcado como FINAL_REVIEW`
  )

  // itens de estudo do plano batem com kind = STUDY
  const mismatches = classified.filter((item) => {
    const planned = persisted.find((p) => p.id === item.id)!
    if (planned.phase === "STUDY") return item.kind !== "STUDY"
    return item.kind !== "REVIEW"
  })
  eq(mismatches.length, 0, `${label}: kind divergente do plano`)

  // um item cujo topicId é null não quebra a classificação
  const withNull = classifyScheduleItems(
    [{ id: "x", topicId: null, scheduledFor: addDays(start, 1) }],
    { startDate: start, studyDays }
  )
  eq(withNull[0]?.kind, "REVIEW", `${label}: item sem topicId`)
}

function testHelpers() {
  const base = new Date(2026, 9, 20, 15, 30)
  eq(toDateKey(base), "2026-10-20", "toDateKey")
  eq(toDateKey(addDays(base, 1)), "2026-10-21", "toDateKey +1 dia")
  eq(
    startOfDay(base).getHours(),
    0,
    "startOfDay zera as horas"
  )
  eq(addDays(base, 10).getDate(), 30, "addDays")

  // A data exibida precisa ser o dia agendado — nunca o dia anterior.
  // `new Date("2026-10-20")` seria meia-noite UTC e mostraria 19/10 em UTC-3.
  eq(
    formatDateKeyPtBr("2026-10-20"),
    "terça-feira, 20 de outubro",
    "formatDateKeyPtBr não desloca o dia"
  )
  eq(
    formatDateKeyPtBr("2026-01-01"),
    "quinta-feira, 01 de janeiro",
    "formatDateKeyPtBr em janeiro"
  )
}

function testValidation() {
  const expectThrow = (fn: () => unknown, label: string) => {
    try {
      fn()
      check(false, `${label}: deveria ter lançado`)
    } catch {
      check(true, label)
    }
  }

  expectThrow(() => buildStudyPlan([], 5, 2), "sem assuntos")
  expectThrow(() => buildStudyPlan([1], 0, 2), "janela de estudo vazia")
  expectThrow(() => buildStudyPlan([1], 5, 0), "revisão final vazia")
  expectThrow(() => buildStudyPlan([1], 2.5, 2), "dias fracionários")
}

console.log("Testes da política do cronograma reverso (Edital Fechado)\n")

for (const scenario of SCENARIOS) {
  testScenario(scenario)
}
testClassification()
testHelpers()
testValidation()

console.log(`\n${passed} verificações passaram, ${failed} falharam.`)
if (failed > 0) {
  process.exit(1)
}

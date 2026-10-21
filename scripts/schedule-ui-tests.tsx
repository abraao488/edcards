/**
 * Teste de render da tela de resultado do cronograma (Edital Fechado).
 *
 * Renderiza o componente real do cliente com um cronograma de exemplo e
 * confere o HTML: rótulos de fase (Estudo / Revisão / Revisão final), a data
 * correta do dia (sem o deslocamento de fuso) e o resumo do plano.
 *
 * Uso: npx tsx scripts/schedule-ui-tests.tsx
 */
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { EditalClient } from "../src/app/edital/client"
import { addDays, startOfDay, toDateKey, type ScheduleItemKind } from "../src/lib/schedule/plan"
import type { ScheduleWithDetails } from "../src/lib/schedule/actions"

type MockItem = NonNullable<ScheduleWithDetails>["items"][number]

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

function buildMockSchedule(): ScheduleWithDetails {
  const today = startOfDay(new Date(2026, 9, 20))
  const examDate = addDays(today, 9)
  const studyDays = 6
  const reviewDays = 3

  const topicNames = ["Direito Constitucional", "Direito Administrativo", "Português"]
  const items: MockItem[] = []
  const groupedByDay: Record<
    string,
    NonNullable<ScheduleWithDetails>["groupedByDay"][string]
  > = {}

  const push = (dayIndex: number, topicIndex: number, phase: "STUDY" | "REVIEW") => {
    const scheduledFor = addDays(today, dayIndex)
    const kind: ScheduleItemKind = phase === "STUDY" ? "STUDY" : "REVIEW"
    const item: MockItem = {
      id: `item-${dayIndex}-${topicIndex}`,
      scheduleId: "schedule-1",
      subjectId: "subject-1",
      topicId: `topic-${topicIndex}`,
      scheduledFor,
      completed: false,
      subject: { id: "subject-1", name: "Matéria Exemplo", userId: "u", order: 0 },
      topic: {
        id: `topic-${topicIndex}`,
        subjectId: "subject-1",
        name: topicNames[topicIndex % topicNames.length]!,
        order: topicIndex,
        createdAt: today,
      },
      kind,
      phase:
        dayIndex >= studyDays
          ? "FINAL_REVIEW"
          : phase === "STUDY"
            ? "STUDY"
            : "INTERMEDIATE_REVIEW",
    }
    items.push(item)
    const key = toDateKey(scheduledFor)
    if (!groupedByDay[key]) groupedByDay[key] = []
    groupedByDay[key]!.push(item)
  }

  // 3 dias de estudo (0, 2 e 4) + revisões intermediárias (1 e 3) + 3 dias finais
  push(0, 0, "STUDY")
  push(1, 0, "REVIEW")
  push(2, 1, "STUDY")
  push(3, 1, "REVIEW")
  push(4, 2, "STUDY")
  push(6, 0, "REVIEW")
  push(7, 1, "REVIEW")
  push(8, 2, "REVIEW")

  return {
    id: "schedule-1",
    userId: "u",
    examDate,
    totalDays: studyDays,
    startDate: today,
    createdAt: today,
    items,
    groupedByDay,
    scheduleId: "schedule-1",
    totalItems: items.length,
  } as unknown as ScheduleWithDetails
}

const html = renderToStaticMarkup(
  <EditalClient initialSchedule={buildMockSchedule()} />
)

check(html.includes("Cronograma do Edital"), "cabeçalho do cronograma")
check(html.includes("6 dias de estudo"), "resumo com dias de estudo")
check(html.includes("3 dias de revisão final"), "resumo com dias de revisão final")
check(html.includes("2 dias de revisão"), "resumo com dias de revisão intermediária")
check(html.includes("8 itens"), "resumo com total de itens")
check(html.includes("criado em"), "resumo com a data de criação do cronograma")
check(html.includes("Revisão final"), "rótulo da revisão final")
check(html.includes("Estudo"), "rótulo da fase de estudo")
check(html.includes("Revisão"), "rótulo de revisão nos itens")

// a data exibida tem de ser o dia agendado (20/10), não 19/10
check(
  html.includes("terça-feira, 20 de outubro"),
  "data do primeiro dia correta (sem deslocamento de fuso)"
)
check(!html.includes("segunda-feira, 19 de outubro"), "não exibe o dia anterior")

// a fase aparece no cabeçalho de cada dia
const finalDayIndex = html.indexOf("Revisão final")
check(finalDayIndex > 0, "fase final presente no HTML")

console.log("Testes de render da tela de cronograma (Edital Fechado)\n")
console.log(`${passed} verificações passaram, ${failed} falharam.`)
if (failed > 0) {
  process.exit(1)
}

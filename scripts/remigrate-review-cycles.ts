/**
 * Remigração idempotente: corrige ciclos de revisão cujo currentReview foi
 * herdado incorretamente do modelo antigo (currentCycleDay + 1) durante o
 * backfill-review-cycles.ts.
 *
 * Modo dry-run (padrão):
 *   npx tsx scripts/remigrate-review-cycles.ts           -> lista o que faria
 *   npx tsx scripts/remigrate-review-cycles.ts --apply   -> aplica correções
 *
 * Idempotente: rodar múltiplas vezes não duplica efeito.
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

function loadEnv() {
  const p = resolve(process.cwd(), ".env")
  try {
    const content = readFileSync(p, "utf-8")
    for (const line of content.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
      if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "")
    }
  } catch {
    console.error("Aviso: .env nao encontrado no cwd.")
  }
}

loadEnv()

async function main() {
  const apply = process.argv.includes("--apply")
  const { PrismaClient } = await import("@prisma/client")

  const prisma = new PrismaClient()

  console.log(`\nRemigracao de ciclos - modo: ${apply ? "APLICAR" : "DRY-RUN (somente leitura)"}\n`)

  const affectedCycles = await prisma.reviewCycle.findMany({
    where: {
      OR: [
        { currentReview: { gt: 1 } },
        { status: "COMPLETED" },
      ],
    },
    include: {
      scheduledReviews: {
        orderBy: { order: "asc" },
      },
      progressCard: {
        select: {
          id: true,
          currentCycleDay: true,
          isCycleEnded: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  })

  if (affectedCycles.length === 0) {
    console.log("Nenhum ciclo afetado encontrado. Nenhuma acao necessaria.")
    await prisma.$disconnect()
    return
  }

  console.log(`Encontrados ${affectedCycles.length} ciclo(s) para corrigir:\n`)

  let totalScheduledReviewsToReset = 0

  for (const cycle of affectedCycles) {
    const completedCount = cycle.scheduledReviews.filter(
      (sr) => sr.completedAt !== null
    ).length
    const firstSchedule = cycle.scheduledReviews[0]?.scheduleDate ?? new Date()

    totalScheduledReviewsToReset += completedCount

    console.log(`  Ciclo ${cycle.id.slice(0, 8)}...`)
    console.log(`    Flashcard:  ${cycle.flashcardId.slice(0, 8)}...`)
    console.log(`    Classif:    ${cycle.classification} (${cycle.totalReviews} revisoes)`)
    console.log(`    currentReview: ${cycle.currentReview} -> 1`)
    console.log(`    status:     ${cycle.status} -> ACTIVE`)
    console.log(`    ScheduledReviews: ${completedCount}/${cycle.scheduledReviews.length} concluidas -> 0`)
    console.log(`    ProgressCard.currentCycleDay: ${cycle.progressCard?.currentCycleDay} -> 1`)
    console.log(`    ProgressCard.isCycleEnded: ${cycle.progressCard?.isCycleEnded} -> false`)
    console.log(`    nextReviewDate: -> ${firstSchedule.toISOString().slice(0, 10)}`)
    console.log()
  }

  console.log(`Resumo: ${affectedCycles.length} ciclo(s), ${totalScheduledReviewsToReset} scheduledReview(s) a desmarcar\n`)

  if (!apply) {
    console.log("DRY-RUN: nenhuma alteracao aplicada. Rode com --apply para corrigir.")
    await prisma.$disconnect()
    return
  }

  console.log("Aplicando correcoes...\n")

  let ok = 0
  let errored = 0

  for (const cycle of affectedCycles) {
    try {
      const firstSchedule = cycle.scheduledReviews[0]?.scheduleDate ?? new Date()

      await prisma.$transaction([
        prisma.reviewCycle.update({
          where: { id: cycle.id },
          data: {
            currentReview: 1,
            status: "ACTIVE",
          },
        }),
        prisma.scheduledReview.updateMany({
          where: {
            cycleId: cycle.id,
            completedAt: { not: null },
          },
          data: {
            completedAt: null,
          },
        }),
        prisma.progressCard.update({
          where: { id: cycle.progressCardId },
          data: {
            currentCycleDay: 1,
            isCycleEnded: false,
            nextReviewDate: firstSchedule,
          },
        }),
        prisma.flashcard.update({
          where: { id: cycle.flashcardId },
          data: {
            currentCycleDay: 1,
            cycleCompleted: false,
            nextReview: firstSchedule,
          },
        }),
      ])

      ok++
      console.log(`  OK  ${cycle.id.slice(0, 8)} (${cycle.classification})`)
    } catch (err) {
      errored++
      console.error(`  ERRO ${cycle.id.slice(0, 8)}: ${(err as Error).message}`)
    }
  }

  console.log(`\nConcluido: ${ok} corrigido(s), ${errored} erro(s)`)
  await prisma.$disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

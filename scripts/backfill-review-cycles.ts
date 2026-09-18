/**
 * Backfill idempotente: cria o ReviewCycle + ScheduledReview persistidos para
 * todos os ProgressCard que passaram pela 2ª resolução (hasChosenEvalMode=true)
 * ANTES da introdução do cronograma persistido, e que ainda não possuem ciclo.
 *
 * Idempotente: cards que já possuem ReviewCycle (qualquer status) são ignorados.
 * Usa apenas o client Prisma (SEM migrate diff/shadow) — escrita em tabelas novas.
 *
 * Classificação: dificuldade conhecida (difficultyStage > Flashcard.difficultyLevel)
 * base = firstReviewAt ?? now. currentCycleDay (0-based) vira revisões já feitas.
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
    console.error("Aviso: .env não encontrado no cwd — esperando env externo (DATABASE_URL).")
  }
}

loadEnv()

async function main() {
  const { PrismaClient } = await import("@prisma/client")
  const { buildReviewSchedule } = await import("../src/lib/srs-review-utils")

  const prisma = new PrismaClient()

  const cards = await prisma.progressCard.findMany({
    where: {
      hasChosenEvalMode: true,
      reviewCycles: { none: {} },
    },
    include: {
      flashcard: { select: { id: true, difficultyLevel: true } },
    },
  })

  console.log(`Backfill: ${cards.length} card(s) para receber ciclo.`)

  const valid = (d: unknown): d is "EASY" | "MEDIUM" | "HARD" =>
    d === "EASY" || d === "MEDIUM" || d === "HARD"

  let created = 0
  let errored = 0

  for (const card of cards) {
    try {
      const raw = valid(card.difficultyStage)
        ? card.difficultyStage
        : valid(card.flashcard.difficultyLevel)
        ? card.flashcard.difficultyLevel
        : "MEDIUM"
      const classification = raw as "EASY" | "MEDIUM" | "HARD"

      const baseDate = card.firstReviewAt ?? new Date()
      const schedule = buildReviewSchedule(classification, baseDate)
      const total = schedule.length
      const doneCount = Math.min(Math.max(card.currentCycleDay, 0), total)
      const ended = card.isCycleEnded || doneCount >= total

      const cycleId = crypto.randomUUID()
      const status = ended ? "COMPLETED" : "ACTIVE"
      const nextReviewDate = ended
        ? schedule[total - 1].scheduleDate
        : schedule[doneCount].scheduleDate

      await prisma.$transaction([
        prisma.reviewCycle.create({
          data: {
            id: cycleId,
            flashcardId: card.flashcard.id,
            progressCardId: card.id,
            profileId: card.profileId,
            baseDate,
            classification,
            status: status as "ACTIVE" | "COMPLETED",
            totalReviews: total,
            currentReview: ended ? total : doneCount + 1,
            initialCycleEvaluationCompleted: true,
          },
        }),
        prisma.scheduledReview.createMany({
          data: schedule.map((s, i) => ({
            cycleId,
            flashcardId: card.flashcard.id,
            order: i + 1,
            scheduleDate: s.scheduleDate,
            isFinal: s.isFinal,
            completedAt: ended || i < doneCount ? baseDate : null,
          })),
        }),
        prisma.progressCard.update({
          where: { id: card.id },
          data: {
            difficultyStage: classification,
            currentCycleDay: ended ? total : doneCount + 1,
            isCycleEnded: ended,
            nextReviewDate,
          },
        }),
        prisma.flashcard.update({
          where: { id: card.flashcard.id },
          data: {
            difficultyLevel: classification,
            currentCycleDay: ended ? total : doneCount + 1,
            cycleCompleted: ended,
            nextReview: nextReviewDate,
          },
        }),
      ])

      created++
      process.stdout.write(
        `  OK ${card.id.slice(0, 8)} ${classification} ${ended ? "COMPLETED" : `ACTIVE(${doneCount + 1}/${total})`}\n`
      )
    } catch (err) {
      errored++
      console.error(`  ERRO ${card.id}:`, (err as Error).message)
    }
  }

  console.log(`\nBackfill concluído: criados=${created} erros=${errored}`)
  await prisma.$disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
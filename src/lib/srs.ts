"use server"

import * as Sentry from "@sentry/nextjs"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import {
  buildReviewSchedule,
  classificationToRating,
  type DifficultyStage,
  type SRSReviewResult,
} from "@/lib/srs-review-utils"
import type { Prisma } from "@prisma/client"

export type { DifficultyStage, SRSReviewResult }

const REVALIDATE_PATHS = [
  "/dashboard/flashcards",
  "/flashcards",
  "/dashboard",
  "/materias",
  "/gerenciador",
]

// Revalidate é inofensivo em testes fora de uma request; falhas aqui nunca podem
// invalidar a operação de banco já concluída.
function safeRevalidate(paths: string[]) {
  for (const path of paths) {
    try {
      revalidatePath(path)
    } catch {
      // environment sem request context (ex.: testes) — ignora
    }
  }
}

// Jaccard similarity helpers for local fallback
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, "")
    .trim()
}

function calculateSimilarity(a: string, b: string): number {
  const wordsA = a.split(/\s+/).filter(Boolean)
  const wordsB = b.split(/\s+/).filter(Boolean)
  if (wordsA.length === 0 && wordsB.length === 0) return 1
  if (wordsA.length === 0 || wordsB.length === 0) return 0
  const setB = new Set(wordsB)
  const intersection = wordsA.filter((w) => setB.has(w))
  const union = Array.from(new Set([...wordsA, ...wordsB]))
  return union.length > 0 ? intersection.length / union.length : 0
}

export interface AIEvaluation {
  difficulty: DifficultyStage
  feedback: string | null
}

/**
 * Evaluates the student's answer semantically using Groq AI
 * or uses manual difficulty if provided, or falls back to Jaccard similarity.
 * Returns the difficulty plus an optional short feedback message (AI only).
 */
export async function evaluateAnswerWithAI(
  question: string,
  correctAnswer: string,
  studentAnswer: string,
  userId?: string,
  manualDifficulty?: DifficultyStage
): Promise<AIEvaluation> {
  // 1. Se o usuário selecionou uma dificuldade manualmente (autoavaliação),
  // respeita a escolha imediata sem consultar a IA
  if (manualDifficulty) {
    return { difficulty: manualDifficulty, feedback: null }
  }

  // 2. Verifica se o usuário desabilitou a IA nas configurações
  if (userId) {
    try {
      const settings = await prisma.userSettings.findUnique({
        where: { userId },
      })
      if (settings && !settings.aiEnabled) {
        const normalizedUser = normalizeText(studentAnswer)
        const normalizedCorrect = normalizeText(correctAnswer)
        const sim = calculateSimilarity(normalizedUser, normalizedCorrect)
        if (sim >= 0.7) return { difficulty: "EASY", feedback: null }
        if (sim >= 0.4) return { difficulty: "MEDIUM", feedback: null }
        return { difficulty: "HARD", feedback: null }
      }
    } catch (err) {
      console.error("Erro ao ler UserSettings:", err)
      Sentry.captureException(err, { tags: { source: "srs/user-settings" } })
    }
  }

  // 3. Avaliação semântica via Groq API
  const apiKey = process.env.GROQ_API_KEY
  if (apiKey) {
    try {
      const response = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          signal: AbortSignal.timeout(10000), // 10s timeout
          body: JSON.stringify({
            model: "openai/gpt-oss-120b",
            messages: [
              {
                role: "system",
                content: `Você é um avaliador de respostas de estudo para concurso e vestibulares. Compare semanticamente a resposta do aluno com o gabarito oficial para a pergunta dada.
Classifique a resposta estritamente em uma das três opções:
- EASY: O aluno demonstrou domínio claro (resposta correta, alta equivalência conceitual ao gabarito)
- MEDIUM: O aluno respondeu parcialmente correto ou esqueceu detalhes conceituais importantes
- HARD: O aluno errou, deu uma resposta incorreta ou muito distante do gabarito

Além da classificação, escreva um campo "feedback": uma frase curta (máximo 20 palavras), em português, com tom encorajador mas honesto, explicando especificamente o que estava certo ou errado na resposta do aluno em relação ao gabarito.

Retorne estritamente um JSON estruturado como:
{
  "difficulty": "EASY" | "MEDIUM" | "HARD",
  "feedback": "frase curta sobre o desempenho do aluno"
}`,
              },
              {
                role: "user",
                content: `Pergunta: ${question}\nGabarito/Resposta Correta: ${correctAnswer}\nResposta do Aluno: ${studentAnswer}`,
              },
            ],
            response_format: { type: "json_object" },
            temperature: 0.1,
          }),
        }
      )

      if (response.ok) {
        const data = await response.json()
        const rawContent = data.choices?.[0]?.message?.content || "{}"
        let result: { difficulty?: string; feedback?: string } = {}
        try {
          result = JSON.parse(rawContent)
        } catch {
          const match = rawContent.match(/\{[\s\S]*"difficulty"[\s\S]*\}/)
          if (match) result = JSON.parse(match[0])
        }

        if (
          result.difficulty === "EASY" ||
          result.difficulty === "MEDIUM" ||
          result.difficulty === "HARD"
        ) {
          const feedback =
            typeof result.feedback === "string" && result.feedback.trim().length > 0
              ? result.feedback.trim()
              : null
          return { difficulty: result.difficulty as DifficultyStage, feedback }
        }
      } else {
        console.error("Groq API retornou status:", response.status, response.statusText)
      }
    } catch (err) {
      console.error("Groq request falhou, usando fallback de similaridade:", err)
      Sentry.captureException(err, { tags: { source: "srs/evaluate-answer" } })
    }
  }

  // 4. Fallback local: Similaridade de Jaccard
  const normalizedUser = normalizeText(studentAnswer)
  const normalizedCorrect = normalizeText(correctAnswer)
  const similarity = calculateSimilarity(normalizedUser, normalizedCorrect)

  if (similarity >= 0.7) return { difficulty: "EASY", feedback: null }
  if (similarity >= 0.4) return { difficulty: "MEDIUM", feedback: null }
  return { difficulty: "HARD", feedback: null }
}

/**
 * Skips a card review, moving its nextReviewDate to tomorrow (+1 day)
 * without modifying its cycle stage or classification. Se o card está dentro de
 * um ciclo ativo, a revisão agendada pendente também é movida para amanhã.
 */
export async function skipFlashcard(progressCardId: string): Promise<void> {
  const progressCard = await prisma.progressCard.findUnique({
    where: { id: progressCardId },
    select: {
      flashcardId: true,
      reviewCycles: {
        where: { status: "ACTIVE" },
        select: {
          scheduledReviews: {
            where: { completedAt: null },
            orderBy: { order: "asc" },
            take: 1,
            select: { id: true, scheduleDate: true },
          },
        },
        take: 1,
      },
    },
  })

  if (!progressCard) {
    throw new Error("ProgressCard não encontrado")
  }

  const nextDay = new Date()
  nextDay.setDate(nextDay.getDate() + 1)

  const pending = progressCard.reviewCycles[0]?.scheduledReviews[0]

  const ops: Prisma.PrismaPromise<unknown>[] = [
    prisma.progressCard.update({
      where: { id: progressCardId },
      data: { nextReviewDate: nextDay },
    }),
    prisma.flashcard.update({
      where: { id: progressCard.flashcardId },
      data: { nextReview: nextDay },
    }),
  ]

  if (pending) {
    ops.push(
      prisma.scheduledReview.update({
        where: { id: pending.id },
        data: { scheduleDate: nextDay },
      })
    )
  }

  await prisma.$transaction(ops)

  safeRevalidate(REVALIDATE_PATHS)
}

/**
 * Submits the first resolution of a card, setting firstReviewAt = now()
 * and scheduling nextReviewDate for 24h later without entering SRS cycle yet.
 * FIX streak: também cria FlashcardReview para alimentar calculateStreak.
 */
export async function submitFirstReview(
  progressCardId: string,
  userId: string
): Promise<{
  nextReviewDate: Date
}> {
  const progressCard = await prisma.progressCard.findUnique({
    where: { id: progressCardId },
    select: { flashcardId: true, firstReviewAt: true },
  })

  if (!progressCard) {
    throw new Error("ProgressCard não encontrado")
  }

  if (progressCard.firstReviewAt) {
    throw new Error("Este card já passou pela primeira resolução")
  }

  const now = new Date()
  const nextReviewDate = new Date(now.getTime() + 24 * 60 * 60 * 1000)

  await prisma.$transaction([
    prisma.progressCard.update({
      where: { id: progressCardId },
      data: {
        firstReviewAt: now,
        nextReviewDate,
        totalReviews: { increment: 1 },
      },
    }),
    prisma.flashcard.update({
      where: { id: progressCard.flashcardId },
      data: {
        nextReview: nextReviewDate,
        lastReview: now,
      },
    }),
    prisma.flashcardReview.create({
      data: {
        flashcardId: progressCard.flashcardId,
        userId,
        date: now,
        quality: 3,
        difficultyLevel: "MEDIUM",
        source: "SCHEDULED",
      },
    }),
  ])

  safeRevalidate(REVALIDATE_PATHS)

  return { nextReviewDate }
}

export interface CycleCreationResult {
  classification: DifficultyStage
  feedback: string | null
  cycleId: string
  nextReviewDate: Date
  scheduleDates: Date[]
  totalReviews: number
}

export interface CycleReviewResult {
  cycleId: string
  classification: DifficultyStage
  nextReviewDate: Date
  currentReview: number // 1-based: próxima revisão a fazer
  totalReviews: number
  isFinal: boolean // acabou de completar a última revisão do ciclo
  isCycleCompleted: boolean
}

interface CreateCycleParams {
  progressCardId: string
  profileId: string
  classification: DifficultyStage
  feedback: string | null
  flashcardId: string
  userId: string
  studentAnswer: string
}

/**
 * Cria o ciclo de revisão completo para um card a partir da classificação
 * (única por ciclo). Persiste a avaliação (FlashcardReview com cycleId),
 * o ReviewCycle ACTIVE e todas as ScheduledReview do cronograma.
 * O cronograma é calculado a partir da data-base (agora) com intervalos
 * NÃO cumulativos — nunca é recalculado durante o ciclo.
 */
async function createCycleInternal(params: CreateCycleParams): Promise<CycleCreationResult> {
  const baseDate = new Date()
  const schedule = buildReviewSchedule(params.classification, baseDate)
  const cycleId = crypto.randomUUID()
  const rating = classificationToRating(params.classification)
  const nextReviewDate = schedule[0].scheduleDate

  await prisma.$transaction([
    prisma.reviewCycle.create({
      data: {
        id: cycleId,
        flashcardId: params.flashcardId,
        progressCardId: params.progressCardId,
        profileId: params.profileId,
        baseDate,
        classification: params.classification,
        status: "ACTIVE",
        totalReviews: schedule.length,
        currentReview: 1,
        initialCycleEvaluationCompleted: true,
      },
    }),
    prisma.scheduledReview.createMany({
      data: schedule.map((s, index) => ({
        cycleId,
        flashcardId: params.flashcardId,
        order: index + 1,
        scheduleDate: s.scheduleDate,
        isFinal: s.isFinal,
      })),
    }),
    prisma.progressCard.update({
      where: { id: params.progressCardId },
      data: {
        difficultyStage: params.classification,
        currentCycleDay: 1,
        isCycleEnded: false,
        hasChosenEvalMode: true,
        lastRating: rating,
        nextReviewDate,
      },
    }),
    prisma.flashcard.update({
      where: { id: params.flashcardId },
      data: {
        difficultyLevel: params.classification,
        currentCycleDay: 1,
        cycleCompleted: false,
        nextReview: nextReviewDate,
        lastReview: baseDate,
      },
    }),
    prisma.flashcardReview.create({
      data: {
        flashcardId: params.flashcardId,
        userId: params.userId,
        date: baseDate,
        quality: rating,
        difficultyLevel: params.classification,
        userAnswer: params.studentAnswer?.slice(0, 2000) || null,
        aiEvaluation: params.feedback?.slice(0, 2000) || null,
        source: "SCHEDULED",
        cycleId,
      },
    }),
  ])

  safeRevalidate(REVALIDATE_PATHS)

  return {
    classification: params.classification,
    feedback: params.feedback,
    cycleId,
    nextReviewDate,
    scheduleDates: schedule.map((s) => s.scheduleDate),
    totalReviews: schedule.length,
  }
}

/**
 * Classificação definitiva do card na 2ª resolução (24h após a 1ª).
 * Cria o ciclo de revisão completo. Guarda: só é permitida quando NÃO existe
 * ciclo ativo (a classificação acontece uma única vez por ciclo — nunca
 * é recalculada durante o ciclo).
 */
export async function classifyAndCreateCycle(
  progressCardId: string,
  studentAnswer: string,
  userId: string,
  manualDifficulty?: DifficultyStage
): Promise<CycleCreationResult> {
  const progressCard = await prisma.progressCard.findUnique({
    where: { id: progressCardId },
    include: {
      flashcard: { select: { id: true, front: true, back: true } },
      reviewCycles: {
        where: { status: "ACTIVE" },
        select: { id: true },
        take: 1,
      },
    },
  })

  if (!progressCard) {
    throw new Error("ProgressCard não encontrado")
  }

  if (progressCard.reviewCycles.length > 0) {
    throw new Error("Este card já possui um ciclo de revisão ativo")
  }

  const { difficulty, feedback } = await evaluateAnswerWithAI(
    progressCard.flashcard.front,
    progressCard.flashcard.back,
    studentAnswer,
    userId,
    manualDifficulty
  )

  return createCycleInternal({
    progressCardId,
    profileId: progressCard.profileId,
    classification: difficulty,
    feedback,
    flashcardId: progressCard.flashcard.id,
    userId,
    studentAnswer,
  })
}

/**
 * Completar uma revisão DENTRO do ciclo ativo. Não reclassifica: o ciclo e o
 * cronograma foram decididos na classificação e permanecem congelados. Marca a
 * ScheduledReview atual como concluída e avança `currentReview`. Ao completar a
 * última, finaliza o ciclo (`COMPLETED`) e libera a renovação.
 */
export async function completeCycleReview(
  progressCardId: string,
  studentAnswer?: string,
  userId?: string
): Promise<CycleReviewResult> {
  const progressCard = await prisma.progressCard.findUnique({
    where: { id: progressCardId },
    include: {
      flashcard: { select: { id: true } },
      reviewCycles: {
        where: { status: "ACTIVE" },
        include: {
          scheduledReviews: { orderBy: { order: "asc" } },
        },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  })

  if (!progressCard) {
    throw new Error("ProgressCard não encontrado")
  }

  const cycle = progressCard.reviewCycles[0]
  if (!cycle) {
    throw new Error("Nenhum ciclo de revisão ativo para este card")
  }

  const pending = cycle.scheduledReviews.find((s) => s.order === cycle.currentReview)
  if (!pending) {
    throw new Error("Revisão agendada não encontrada para este ciclo")
  }

  const isLast = cycle.currentReview >= cycle.totalReviews
  const now = new Date()

  const ops: Prisma.PrismaPromise<unknown>[] = [
    prisma.scheduledReview.update({
      where: { id: pending.id },
      data: { completedAt: now },
    }),
  ]

  let nextReviewDate: Date

  if (isLast) {
    nextReviewDate = pending.scheduleDate
    ops.push(
      prisma.reviewCycle.update({
        where: { id: cycle.id },
        data: { status: "COMPLETED" },
      }),
      prisma.progressCard.update({
        where: { id: progressCardId },
        data: {
          totalReviews: { increment: 1 },
          isCycleEnded: true,
          nextReviewDate: pending.scheduleDate,
        },
      }),
      prisma.flashcard.update({
        where: { id: progressCard.flashcard.id },
        data: {
          cycleCompleted: true,
          nextReview: pending.scheduleDate,
          lastReview: now,
          currentCycleDay: cycle.currentReview,
        },
      })
    )
  } else {
    const nextScheduled = cycle.scheduledReviews.find(
      (s) => s.order === cycle.currentReview + 1
    )
    if (!nextScheduled) {
      throw new Error("Cronograma do ciclo inconsistente")
    }
    nextReviewDate = nextScheduled.scheduleDate
    ops.push(
      prisma.reviewCycle.update({
        where: { id: cycle.id },
        data: { currentReview: cycle.currentReview + 1 },
      }),
      prisma.progressCard.update({
        where: { id: progressCardId },
        data: {
          totalReviews: { increment: 1 },
          currentCycleDay: cycle.currentReview + 1,
          isCycleEnded: false,
          nextReviewDate,
        },
      }),
      prisma.flashcard.update({
        where: { id: progressCard.flashcard.id },
        data: {
          currentCycleDay: cycle.currentReview + 1,
          cycleCompleted: false,
          nextReview: nextReviewDate,
          lastReview: now,
        },
      })
    )
  }

  if (userId) {
    ops.push(
      prisma.flashcardReview.create({
        data: {
          flashcardId: progressCard.flashcard.id,
          userId,
          date: now,
          quality: classificationToRating(cycle.classification),
          difficultyLevel: cycle.classification,
          userAnswer: studentAnswer?.slice(0, 2000) || null,
          aiEvaluation: null,
          source: "SCHEDULED",
          cycleId: cycle.id,
        },
      })
    )
  }

  await prisma.$transaction(ops)

  safeRevalidate(REVALIDATE_PATHS)

  return {
    cycleId: cycle.id,
    classification: cycle.classification,
    nextReviewDate,
    currentReview: isLast ? cycle.currentReview : cycle.currentReview + 1,
    totalReviews: cycle.totalReviews,
    isFinal: isLast,
    isCycleCompleted: isLast,
  }
}

/**
 * Renova o ciclo de um card que JÁ concluiu todas as revisões agendadas.
 * Reavalia a resposta (nova classificação do próximo ciclo), preserva o ciclo
 * anterior na história e cria um novo ReviewCycle ACTIVE com novo cronograma.
 * Guarda: só permitido quando não existe ciclo ativo.
 */
export async function renewReviewCycle(
  progressCardId: string,
  studentAnswer: string,
  userId: string,
  manualDifficulty?: DifficultyStage
): Promise<CycleCreationResult> {
  const progressCard = await prisma.progressCard.findUnique({
    where: { id: progressCardId },
    include: {
      flashcard: { select: { id: true, front: true, back: true } },
      reviewCycles: {
        where: { status: "ACTIVE" },
        select: { id: true },
        take: 1,
      },
    },
  })

  if (!progressCard) {
    throw new Error("ProgressCard não encontrado")
  }

  if (progressCard.reviewCycles.length > 0) {
    throw new Error("Ciclo de revisão ainda ativo — não é possível renovar")
  }

  const { difficulty, feedback } = await evaluateAnswerWithAI(
    progressCard.flashcard.front,
    progressCard.flashcard.back,
    studentAnswer,
    userId,
    manualDifficulty
  )

  return createCycleInternal({
    progressCardId,
    profileId: progressCard.profileId,
    classification: difficulty,
    feedback,
    flashcardId: progressCard.flashcard.id,
    userId,
    studentAnswer,
  })
}

export async function ensureProgressCardsForFlashcards(
  profileId: string,
  flashcardIds: string[]
) {
  if (!flashcardIds.length) return []

  const existingProgress = await prisma.progressCard.findMany({
    where: {
      profileId,
      flashcardId: { in: flashcardIds },
    },
    select: { flashcardId: true },
  })

  const existingSet = new Set(existingProgress.map((p) => p.flashcardId))
  const missingIds = flashcardIds.filter((id) => !existingSet.has(id))

  if (missingIds.length > 0) {
    await prisma.progressCard.createMany({
      data: missingIds.map((id) => ({
        profileId,
        flashcardId: id,
        currentCycleDay: 0,
        nextReviewDate: new Date(),
        difficultyStage: "MEDIUM",
        isCycleEnded: false,
      })),
      skipDuplicates: true,
    })
  }

  const progressCards = await prisma.progressCard.findMany({
    where: {
      profileId,
      flashcardId: { in: flashcardIds },
    },
    include: {
      flashcard: {
        include: {
          topic: {
            include: {
              subject: true,
            },
          },
        },
      },
      reviewCycles: {
        select: {
          id: true,
          classification: true,
          currentReview: true,
          totalReviews: true,
          baseDate: true,
          status: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { nextReviewDate: "asc" },
  })

  return progressCards.map((pc) => {
    const activeCycle = pc.reviewCycles.find((c) => c.status === "ACTIVE") ?? null
    return {
      id: pc.id,
      currentCycleDay: pc.currentCycleDay,
      firstReviewAt: pc.firstReviewAt,
      hasChosenEvalMode: (pc as unknown as { hasChosenEvalMode?: boolean }).hasChosenEvalMode ?? false,
      isCycleEnded: pc.isCycleEnded,
      difficultyStage: (pc.difficultyStage as DifficultyStage) || "MEDIUM",
      activeCycle: activeCycle
        ? {
            id: activeCycle.id,
            classification: activeCycle.classification as DifficultyStage,
            currentReview: activeCycle.currentReview,
            totalReviews: activeCycle.totalReviews,
            baseDate: activeCycle.baseDate,
            isFinal: activeCycle.currentReview >= activeCycle.totalReviews,
          }
        : null,
      hasCompletedCycle: pc.reviewCycles.some((c) => c.status === "COMPLETED"),
      flashcard: {
        id: pc.flashcard.id,
        front: pc.flashcard.front,
        back: pc.flashcard.back,
        cardType: (pc.flashcard as unknown as { cardType?: string }).cardType ?? "BASIC",
        topic: pc.flashcard.topic
          ? {
              id: pc.flashcard.topic.id,
              name: pc.flashcard.topic.name,
              subject: {
                id: pc.flashcard.topic.subject.id,
                name: pc.flashcard.topic.subject.name,
              },
            }
          : null,
      },
    }
  })
}
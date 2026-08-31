"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import {
  calculateNextSRSReview,
  CYCLES,
  type DifficultyStage,
  type SRSReviewResult,
} from "@/lib/srs-review-utils"

export type { DifficultyStage, SRSReviewResult }

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
 * without modifying its current cycle stage or difficulty.
 */
export async function skipFlashcard(progressCardId: string): Promise<void> {
  const progressCard = await prisma.progressCard.findUnique({
    where: { id: progressCardId },
    select: { flashcardId: true },
  })

  if (!progressCard) {
    throw new Error("ProgressCard não encontrado")
  }

  const nextDay = new Date()
  nextDay.setDate(nextDay.getDate() + 1)

  await prisma.$transaction([
    prisma.progressCard.update({
      where: { id: progressCardId },
      data: { nextReviewDate: nextDay },
    }),
    prisma.flashcard.update({
      where: { id: progressCard.flashcardId },
      data: { nextReview: nextDay },
    }),
  ])

  revalidatePath("/dashboard/flashcards")
  revalidatePath("/flashcards")
}

/**
 * Submits the first resolution of a card, setting firstReviewAt = now()
 * and scheduling nextReviewDate for 24h later without entering SRS cycle yet.
 */
export async function submitFirstReview(progressCardId: string): Promise<{
  nextReviewDate: Date
}> {
  const progressCard = await prisma.progressCard.findUnique({
    where: { id: progressCardId },
    select: { flashcardId: true },
  })

  if (!progressCard) {
    throw new Error("ProgressCard não encontrado")
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
  ])

  revalidatePath("/dashboard/flashcards")
  revalidatePath("/flashcards")

  return { nextReviewDate }
}

/**
 * Resets an SRS review cycle when isCycleEnded is reached, setting currentCycleDay = 0,
 * isCycleEnded = false, and scheduling next review according to interval[0].
 */
export async function resetSRSProgressCycle(
  progressCardId: string,
  difficulty?: DifficultyStage
): Promise<{ nextReviewDate: Date }> {
  const progressCard = await prisma.progressCard.findUnique({
    where: { id: progressCardId },
  })

  if (!progressCard) {
    throw new Error("ProgressCard não encontrado")
  }

  const stage = difficulty || (progressCard.difficultyStage as DifficultyStage) || "MEDIUM"
  const cycle = CYCLES[stage] || CYCLES.MEDIUM
  const interval = cycle[0]

  const now = new Date()
  const nextReviewDate = new Date()
  nextReviewDate.setDate(nextReviewDate.getDate() + interval)

  await prisma.$transaction([
    prisma.progressCard.update({
      where: { id: progressCardId },
      data: {
        currentCycleDay: 0,
        isCycleEnded: false,
        nextReviewDate,
        difficultyStage: stage,
      },
    }),
    prisma.flashcard.update({
      where: { id: progressCard.flashcardId },
      data: {
        currentCycleDay: 0,
        cycleCompleted: false,
        nextReview: nextReviewDate,
        lastReview: now,
      },
    }),
  ])

  revalidatePath("/dashboard/flashcards")
  revalidatePath("/flashcards")

  return { nextReviewDate }
}

/**
 * Submits a completed card review (subsequent reviews), evaluating the answer,
 * calculating the next step, and updating the database records.
 */
export async function submitSRSReview(
  progressCardId: string,
  studentAnswer: string,
  userId: string,
  manualDifficulty?: DifficultyStage
): Promise<{
  difficulty: DifficultyStage
  feedback: string | null
  nextReviewDate: Date
  nextCycleDay: number
  isCycleEnded: boolean
}> {
  const progressCard = await prisma.progressCard.findUnique({
    where: { id: progressCardId },
    include: { flashcard: true },
  })

  if (!progressCard) {
    throw new Error("ProgressCard não encontrado")
  }

  // 1. Evaluate with manual selection, AI, or fallback
  const { difficulty, feedback } = await evaluateAnswerWithAI(
    progressCard.flashcard.front,
    progressCard.flashcard.back,
    studentAnswer,
    userId,
    manualDifficulty
  )

  // 2. Calculate next review cycle
  const srsResult = calculateNextSRSReview(progressCard.currentCycleDay, difficulty)

  // Map difficulty stage to rating number for schema: EASY=5, MEDIUM=3, HARD=1
  const rating = difficulty === "EASY" ? 5 : difficulty === "MEDIUM" ? 3 : 1
  const firstReviewAt = progressCard.firstReviewAt || new Date()

  // 3. Update ProgressCard and Flashcard in database
  await prisma.$transaction([
    prisma.progressCard.update({
      where: { id: progressCardId },
      data: {
        lastRating: rating,
        totalReviews: { increment: 1 },
        currentCycleDay: srsResult.nextCycleDay,
        nextReviewDate: srsResult.nextReviewDate,
        difficultyStage: difficulty,
        isCycleEnded: srsResult.isCycleEnded,
        firstReviewAt,
      },
    }),
    prisma.flashcard.update({
      where: { id: progressCard.flashcardId },
      data: {
        nextReview: srsResult.nextReviewDate,
        currentCycleDay: srsResult.nextCycleDay,
        cycleCompleted: srsResult.isCycleEnded,
        difficultyLevel:
          difficulty === "EASY" ? "EASY" : difficulty === "MEDIUM" ? "MEDIUM" : "HARD",
      },
    }),
  ])

  revalidatePath("/dashboard/flashcards")
  revalidatePath("/flashcards")

  return {
    difficulty,
    feedback,
    ...srsResult,
  }
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
    },
    orderBy: { nextReviewDate: "asc" },
  })

  return progressCards.map((pc) => ({
    id: pc.id,
    currentCycleDay: pc.currentCycleDay,
    firstReviewAt: pc.firstReviewAt,
    isCycleEnded: pc.isCycleEnded,
    difficultyStage: (pc.difficultyStage as DifficultyStage) || "MEDIUM",
    flashcard: {
      id: pc.flashcard.id,
      front: pc.flashcard.front,
      back: pc.flashcard.back,
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
  }))
}

"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { ensureUserExists } from "@/lib/auth/sync"

export interface GeneratedFlashcard {
  front: string
  back: string
}

/**
 * Gera flashcards (entre 3 e 10) a partir de um texto/material enviado pelo usuário,
 * usando a Groq AI (mesmo modelo usado em evaluateAnswerWithAI, em src/lib/srs.ts).
 * Lança um erro claro se a API key não estiver configurada ou se a chamada falhar,
 * para que a UI possa avisar o usuário em vez de exibir conteúdo genérico.
 */
export async function generateFlashcardsFromText(
  content: string
): Promise<GeneratedFlashcard[]> {
  // 1. Validações de entrada e configuração
  const trimmedContent = content.trim()
  if (!trimmedContent) {
    throw new Error("Nenhum conteúdo enviado para gerar flashcards.")
  }

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    console.error("GROQ_API_KEY não está configurada no ambiente.")
    throw new Error(
      "A geração por IA não está configurada neste ambiente (GROQ_API_KEY ausente)."
    )
  }

  // 2. Chamada à Groq API (mesmo padrão de src/lib/srs.ts)
  let rawContent = ""
  try {
    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        signal: AbortSignal.timeout(30000), // 30s timeout (geração pode demorar)
        body: JSON.stringify({
          model: "openai/gpt-oss-120b",
          messages: [
            {
              role: "system",
              content: `Você é um especialista em criação de material de estudo para concursos e vestibulares brasileiros.
A partir do conteúdo enviado pelo usuário, gere entre 3 e 10 flashcards cobrindo os pontos mais importantes do material.

Regras:
- O campo "front" deve conter uma pergunta curta e direta, autocontida (sem depender de outros cards).
- O campo "back" deve conter uma resposta objetiva, completa o suficiente para memorização, mas sem enrolação.
- Escreva tudo em português.
- Não invente informações que não estejam no conteúdo enviado.

Retorne estritamente um JSON estruturado como:
{
  "flashcards": [
    { "front": "pergunta curta", "back": "resposta objetiva" }
  ]
}`,
            },
            {
              role: "user",
              content: trimmedContent,
            },
          ],
          response_format: { type: "json_object" },
          temperature: 0.3,
        }),
      }
    )

    if (!response.ok) {
      console.error(
        "Groq API retornou status:",
        response.status,
        response.statusText
      )
      throw new Error(
        `O serviço de IA respondeu com erro (${response.status}). Tenta de novo em instantes.`
      )
    }

    const data = await response.json()
    rawContent = data.choices?.[0]?.message?.content || ""
  } catch (err) {
    // Erros de rede/timeout/fetch caem aqui; erros já intencionais são relançados
    if (
      err instanceof Error &&
      err.message.startsWith("O serviço de IA")
    ) {
      throw err
    }
    console.error("Groq request falhou:", err)
    throw new Error(
      "Não consegui me conectar à IA para gerar os flashcards. Tenta de novo."
    )
  }

  // 3. Parse resiliente do JSON (mesmo padrão de fallback com regex de evaluateAnswerWithAI)
  let result: { flashcards?: { front?: unknown; back?: unknown }[] } = {}
  try {
    result = JSON.parse(rawContent)
  } catch {
    const match = rawContent.match(/\{[\s\S]*"flashcards"[\s\S]*\}/)
    if (!match) {
      throw new Error(
        "A IA retornou uma resposta em formato inesperado. Tenta de novo."
      )
    }
    try {
      result = JSON.parse(match[0])
    } catch {
      throw new Error(
        "A IA retornou uma resposta em formato inesperado. Tenta de novo."
      )
    }
  }

  // 4. Sanitiza e valida os flashcards recebidos
  const flashcards = (result.flashcards || [])
    .filter(
      (card): card is { front: string; back: string } =>
        typeof card?.front === "string" &&
        card.front.trim().length > 0 &&
        typeof card?.back === "string" &&
        card.back.trim().length > 0
    )
    .map((card) => ({ front: card.front.trim(), back: card.back.trim() }))

  if (flashcards.length === 0) {
    throw new Error(
      "A IA não conseguiu extrair flashcards desse conteúdo. Tenta enviar um texto maior ou mais detalhado."
    )
  }

  return flashcards.slice(0, 10)
}


export async function generateFlashcardsFromPDF(formData: FormData): Promise<GeneratedFlashcard[]> {
  const file = formData.get("pdf") as File | null
  if (!file) {
    throw new Error("Nenhum arquivo PDF enviado.")
  }

  if (file.type !== "application/pdf") {
    throw new Error("O arquivo enviado não é um PDF.")
  }

  const MAX_SIZE = 5 * 1024 * 1024 // 5 MB
  if (file.size > MAX_SIZE) {
    throw new Error("O PDF é muito grande (máximo 5 MB). Tente um arquivo menor.")
  }

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  const { PDFParse } = await import("pdf-parse")
  const parser = new PDFParse({ data: buffer, verbosity: 0 })
  const result = await parser.getText()
  const extractedText = (result?.pages ?? [])
    .map((p: { text?: string }) => p.text ?? "")
    .join("\n\n")
    .trim()
  await parser.destroy()
  if (!extractedText) {
    throw new Error(
      "Não foi possível extrair texto deste PDF. Ele pode conter apenas imagens. Tente copiar e colar o texto diretamente."
    )
  }

  if (extractedText.length < 20) {
    throw new Error(
      "O texto extraído do PDF é muito curto para gerar flashcards. Tente enviar um material mais extenso."
    )
  }

  return generateFlashcardsFromText(extractedText)
}

export async function injectFlashcardsToDatabase(cards: { front: string; back: string }[]) {
  const user = await ensureUserExists()

  // Get or create a deck for the user
  let deck = await prisma.deck.findFirst({
    where: { userId: user.id },
  })

  if (!deck) {
    deck = await prisma.deck.create({
      data: {
        name: "Baralho Padrão",
        userId: user.id,
      },
    })
  }

  // Get active profile
  const profile = await prisma.profile.findFirst({
    where: { userId: user.id, isActiveProfile: true },
  })

  if (!profile) {
    throw new Error("Nenhum perfil ativo encontrado")
  }

  // Create flashcards and progress cards
  const createdCards = []
  for (const card of cards) {
    const flashcard = await prisma.flashcard.create({
      data: {
        front: card.front,
        back: card.back,
        deckId: deck.id,
      },
    })

    await prisma.progressCard.create({
      data: {
        profileId: profile.id,
        flashcardId: flashcard.id,
      },
    })

    createdCards.push(flashcard)
  }

  revalidatePath("/dashboard/flashcards")
  revalidatePath("/criar-com-revisai")

  return { count: createdCards.length }
}

"use server"

import * as Sentry from "@sentry/nextjs"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { requireActiveSubscriptionForAction } from "@/lib/subscription/guard"

export interface GeneratedFlashcard {
  front: string
  back: string
}

export interface SubjectTopicInfo {
  id: string
  name: string
  topics: { id: string; name: string }[]
}

export interface ClassificationResult {
  topicId: string | null
  subjectId: string | null
  uncategorized: boolean
}

export interface ClassifiedFlashcard extends GeneratedFlashcard {
  topicId: string | null
  subjectId: string | null
  uncategorized: boolean
}

export interface InjectFlashcardsResult {
  count: number
  uncategorizedCount: number
  uncategorizedCards: ClassifiedFlashcard[]
}

const AI_DAILY_LIMIT = 20

/**
 * Gera flashcards (entre 3 e 10) a partir de um texto/material enviado pelo usuário,
 * usando a Groq AI (mesmo modelo usado em evaluateAnswerWithAI, em src/lib/srs.ts).
 * Lança um erro claro se a API key não estiver configurada ou se a chamada falhar,
 * para que a UI possa avisar o usuário em vez de exibir conteúdo genérico.
 */
export async function generateFlashcardsFromText(
  content: string
): Promise<GeneratedFlashcard[]> {
  // 0. Controle diário de gerações por IA
  const authUser = await requireActiveSubscriptionForAction()

  const now = new Date()
  const startOfToday = new Date(now)
  startOfToday.setHours(0, 0, 0, 0)

  const settings = await prisma.userSettings.upsert({
    where: { userId: authUser.id },
    create: { userId: authUser.id },
    update: {},
  })

  if (settings.aiGenerationsResetAt < startOfToday) {
    await prisma.userSettings.update({
      where: { userId: authUser.id },
      data: { aiGenerationsToday: 0, aiGenerationsResetAt: now },
    })
    settings.aiGenerationsToday = 0
    settings.aiGenerationsResetAt = now
  }

  if (settings.aiGenerationsToday >= AI_DAILY_LIMIT) {
    throw new Error(
      "Você atingiu o limite diário de gerações por IA. Tente novamente amanhã."
    )
  }

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

    // Só conta como geração quando a Groq API retorna com sucesso
    await prisma.userSettings.update({
      where: { userId: authUser.id },
      data: { aiGenerationsToday: { increment: 1 } },
    })

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
    Sentry.captureException(err, { tags: { source: "ai/generate-flashcards" } })
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
  await requireActiveSubscriptionForAction()

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

/**
 * Busca todas as matérias (Subject) e assuntos (Topic) do usuário para uso
 * como contexto nas chamadas de classificação via IA.
 */
async function getUserSubjectsWithTopics(userId: string): Promise<SubjectTopicInfo[]> {
  const subjects = await prisma.subject.findMany({
    where: { userId },
    include: {
      topics: {
        orderBy: { name: "asc" },
      },
    },
    orderBy: { name: "asc" },
  })

  return subjects.map((subject) => ({
    id: subject.id,
    name: subject.name,
    topics: subject.topics.map((topic) => ({
      id: topic.id,
      name: topic.name,
    })),
  }))
}

/**
 * Chama a Groq AI para classificar um flashcard em uma matéria/assunto existente do usuário.
 * Retorna topicId e subjectId se houver correspondência, ou null caso contrário.
 * Em caso de erro na chamada, retorna sem categoria para não bloquear o salvamento.
 */
async function classifyFlashcard(
  flashcard: { front: string; back: string },
  subjectsContext: SubjectTopicInfo[],
  apiKey: string
): Promise<ClassificationResult> {
  if (subjectsContext.length === 0) {
    return { topicId: null, subjectId: null, uncategorized: true }
  }

  const contextLines = subjectsContext.map((s) => {
    const topicNames = s.topics.map((t) => `${t.name} [${t.id}]`).join(", ")
    return `- ${s.name} [${s.id}]: ${topicNames || "(sem assuntos)"}`
  })

  const systemPrompt = `Você é um especialista em classificar conteúdo de estudo para concursos e vestibulares brasileiros.
Dado o conteúdo de um flashcard, determine qual matéria e assunto ele pertence, escolhendo dentre as opções disponíveis abaixo.

Matérias e assuntos disponíveis:
${contextLines.join("\n")}

Regras:
- Escolha APENAS um assunto (topic) dentre os listados acima.
- Se o conteúdo do flashcard não se encaixar claramente em nenhuma matéria/assunto listado, retorne topicId e subjectId como null.
- Não tente forçar uma correspondência quando não houver uma relação clara.

Retorne estritamente um JSON estruturado como:
{
  "topicId": "id-do-topic" ou null,
  "subjectId": "id-do-subject" ou null
}`

  try {
    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        signal: AbortSignal.timeout(15000),
        body: JSON.stringify({
          model: "openai/gpt-oss-120b",
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: `Flashcard frontal: ${flashcard.front}\nFlashcard verso: ${flashcard.back}`,
            },
          ],
          response_format: { type: "json_object" },
          temperature: 0.1,
        }),
      }
    )

    if (!response.ok) {
      console.error(
        "Groq API (classificação) retornou status:",
        response.status,
        response.statusText
      )
      return { topicId: null, subjectId: null, uncategorized: true }
    }

    const data = await response.json()
    const rawContent = data.choices?.[0]?.message?.content || "{}"

    let parsed: { topicId?: unknown; subjectId?: unknown } = {}
    try {
      parsed = JSON.parse(rawContent)
    } catch {
      const match = rawContent.match(
        /\{[\s\S]*"topicId"[\s\S]*"subjectId"[\s\S]*\}/
      )
      if (match) {
        try {
          parsed = JSON.parse(match[0])
        } catch {
          return { topicId: null, subjectId: null, uncategorized: true }
        }
      } else {
        return { topicId: null, subjectId: null, uncategorized: true }
      }
    }

    const topicId =
      typeof parsed.topicId === "string" && parsed.topicId.length > 0
        ? parsed.topicId
        : null
    const subjectId =
      typeof parsed.subjectId === "string" && parsed.subjectId.length > 0
        ? parsed.subjectId
        : null

    if (!topicId || !subjectId) {
      return { topicId: null, subjectId: null, uncategorized: true }
    }

    const subjectExists = subjectsContext.some((s) => s.id === subjectId)
    const topicExists = subjectsContext.some((s) =>
      s.topics.some((t) => t.id === topicId)
    )

    if (!subjectExists || !topicExists) {
      return { topicId: null, subjectId: null, uncategorized: true }
    }

    return { topicId, subjectId, uncategorized: false }
  } catch (err) {
    console.error("Groq request (classificação) falhou:", err)
    Sentry.captureException(err, {
      tags: { source: "ai/classify-flashcard" },
    })
    return { topicId: null, subjectId: null, uncategorized: true }
  }
}

/**
 * Salva flashcards no banco de dados, classificando cada um em uma matéria/assunto
 * existente do usuário via IA antes de salvar. Cards sem correspondência clara
 * ficam com topicId = null e são sinalizados como "sem categoria sugerida" para
 * que o usuário possa escolher manualmente na tela de revisão antes de salvar.
 */
export async function injectFlashcardsToDatabase(
  cards: { front: string; back: string }[]
): Promise<InjectFlashcardsResult> {
  const user = await requireActiveSubscriptionForAction()

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

  const profile = await prisma.profile.findFirst({
    where: { userId: user.id, isActiveProfile: true },
  })

  if (!profile) {
    throw new Error("Nenhum perfil ativo encontrado")
  }

  const subjectsContext = await getUserSubjectsWithTopics(user.id)
  const apiKey = process.env.GROQ_API_KEY || ""

  const classifiedCards: ClassifiedFlashcard[] = []

  for (const card of cards) {
    let classification: ClassificationResult = {
      topicId: null,
      subjectId: null,
      uncategorized: true,
    }

    if (apiKey && subjectsContext.length > 0) {
      classification = await classifyFlashcard(card, subjectsContext, apiKey)
    }

    classifiedCards.push({
      front: card.front,
      back: card.back,
      topicId: classification.topicId,
      subjectId: classification.subjectId,
      uncategorized: classification.uncategorized,
    })
  }

  const createdCards = []
  for (const card of classifiedCards) {
    const flashcard = await prisma.flashcard.create({
      data: {
        front: card.front,
        back: card.back,
        deckId: deck.id,
        topicId: card.topicId || null,
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

  const uncategorizedCards = classifiedCards.filter((c) => c.uncategorized)

  revalidatePath("/dashboard/flashcards")
  revalidatePath("/criar-com-edcards")

  return {
    count: createdCards.length,
    uncategorizedCount: uncategorizedCards.length,
    uncategorizedCards,
  }
}

export interface ConversationMessage {
  id: string
  role: "user" | "assistant"
  content: string
  createdAt: Date
}

export interface ConversationWithMessages {
  id: string
  createdAt: Date
  updatedAt: Date
  messages: ConversationMessage[]
}

/**
 * Busca a última conversa do usuário com suas mensagens,
 * ou cria uma nova conversa vazia se não houver nenhuma.
 */
export async function getOrCreateConversation(): Promise<ConversationWithMessages> {
  const user = await requireActiveSubscriptionForAction()

  const existing = await prisma.aIChat.findFirst({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
      },
    },
  })

  if (existing) {
    return {
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: existing.updatedAt,
      messages: existing.messages.map((m) => ({
        id: m.id,
        role: m.role as "user" | "assistant",
        content: m.content,
        createdAt: m.createdAt,
      })),
    }
  }

  const conversation = await prisma.aIChat.create({
    data: { userId: user.id },
    include: {
      messages: true,
    },
  })

  return {
    id: conversation.id,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
    messages: [],
  }
}

/**
 * Salva uma mensagem (usuário ou assistente) em uma conversa existente.
 * Retorna a mensagem criada.
 */
export async function saveMessage(
  conversationId: string,
  role: "user" | "assistant",
  content: string
): Promise<ConversationMessage> {
  const user = await requireActiveSubscriptionForAction()

  const conversation = await prisma.aIChat.findUnique({
    where: { id: conversationId },
  })

  if (!conversation || conversation.userId !== user.id) {
    throw new Error("Conversa não encontrada")
  }

  const message = await prisma.aIChatMessage.create({
    data: {
      chatId: conversationId,
      role,
      content,
    },
  })

  await prisma.aIChat.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  })

  return {
    id: message.id,
    role: message.role as "user" | "assistant",
    content: message.content,
    createdAt: message.createdAt,
  }
}

/**
 * Cria uma nova conversa para o usuário (usado quando o usuário quer iniciar um chat limpo).
 */
export async function createNewConversation(): Promise<ConversationWithMessages> {
  const user = await requireActiveSubscriptionForAction()

  const conversation = await prisma.aIChat.create({
    data: { userId: user.id },
  })

  return {
    id: conversation.id,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
    messages: [],
  }
}

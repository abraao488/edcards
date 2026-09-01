import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { getOrCreateActiveProfile } from "@/lib/profile/helpers"
import { ensureProgressCardsForFlashcards } from "@/lib/srs"
import { SRSReviewSession } from "@/components/srs-review-session"
import { getReviewQueueCount } from "@/lib/flashcards/upcoming-actions"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export default async function ConsultationPage({
  searchParams,
}: {
  searchParams: { subjectId?: string; topicId?: string }
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const subjectId = searchParams.subjectId
  const topicId = searchParams.topicId

  if (!subjectId && !topicId) {
    return (
      <div className="py-20 text-center">
        <p className="text-muted-foreground">Matéria ou assunto não especificado.</p>
      </div>
    )
  }

  // Suporta revisão por assunto específico (consulta visual sem IA) e por matéria inteira
  let title = ""
  let flashcards: { id: string }[] = []
  let subject: { id: string; name: string } | null = null

  if (topicId) {
    const topic = await prisma.topic.findUnique({
      where: { id: topicId },
      include: { subject: true },
    })
    if (!topic) {
      return (
        <div className="py-20 text-center">
          <p className="text-muted-foreground">Assunto não encontrado.</p>
        </div>
      )
    }
    subject = topic.subject
    title = `Consulta: ${topic.name}`
    const [activeProfileInner, settingsInner, queueCountInner, topicCards] =
      await Promise.all([
        getOrCreateActiveProfile(user.id, user.email || ""),
        prisma.userSettings.findUnique({ where: { userId: user.id } }),
        getReviewQueueCount(),
        prisma.flashcard.findMany({
          where: { topicId, deck: { userId: user.id } },
          select: { id: true },
        }),
      ])
    // Reusa variáveis do escopo externo via atribuição
    flashcards = topicCards
    // Para manter compatibilidade com o retorno abaixo, buscamos novamente com Promise.all pattern
    const [activeProfile, settings, queueCount] = await Promise.all([
      Promise.resolve(activeProfileInner),
      Promise.resolve(settingsInner),
      Promise.resolve(queueCountInner),
    ])
    // Se topicId, já temos dados — retorna cedo
    const progressCards = await ensureProgressCardsForFlashcards(
      activeProfile.id,
      flashcards.map((f) => f.id)
    )

    return (
      <div>
        <Link
          href="/materias"
          className="mb-6 flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar às matérias
        </Link>

        <h1 className="mb-2 text-3xl font-bold text-foreground">{title}</h1>
        <p className="mb-1 text-sm text-muted-foreground">
          Assunto: {topic.name} · Matéria: {subject.name}
        </p>
        <p className="mb-8 text-sm text-muted-foreground">
          Sessão de estudo isolada — apenas revela o gabarito (currentCard.flashcard.back) para autoavaliação visual. Não chama IA nem atualiza o ciclo de revisões.
        </p>

        <SRSReviewSession
          initialProgressCards={progressCards}
          userId={user.id}
          email={user.email || ""}
          isQuizMode={true}
          hideSidebar={true}
          pomodoroMin={settings?.pomodoroMin ?? 25}
          initialQueueCount={queueCount}
        />
      </div>
    )
  }

  const [subjectFetched, activeProfile, settings, queueCount] = await Promise.all([
    prisma.subject.findUnique({
      where: { id: subjectId! },
    }),
    getOrCreateActiveProfile(user.id, user.email || ""),
    prisma.userSettings.findUnique({
      where: { userId: user.id },
    }),
    getReviewQueueCount(),
  ])

  subject = subjectFetched

  if (!subject) {
    return (
      <div className="py-20 text-center">
        <p className="text-muted-foreground">Matéria não encontrada.</p>
      </div>
    )
  }

  title = `Consulta: ${subject.name}`

  flashcards = await prisma.flashcard.findMany({
    where: {
      topic: { subjectId: subject.id },
      deck: { userId: user.id },
    },
    select: {
      id: true,
    },
  })

  const progressCards = await ensureProgressCardsForFlashcards(
    activeProfile.id,
    flashcards.map((f) => f.id)
  )

  return (
    <div>
      <Link
        href="/materias"
        className="mb-6 flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar às matérias
      </Link>

      <h1 className="mb-2 text-3xl font-bold text-foreground">
        Consulta: {subject.name}
      </h1>
      <p className="mb-8 text-sm text-muted-foreground">
        Sessão de estudo isolada - não altera o ciclo de revisões.
      </p>

      <SRSReviewSession
        initialProgressCards={progressCards}
        userId={user.id}
        email={user.email || ""}
        isQuizMode={true}
        hideSidebar={true}
        pomodoroMin={settings?.pomodoroMin ?? 25}
        initialQueueCount={queueCount}
      />
    </div>
  )
}
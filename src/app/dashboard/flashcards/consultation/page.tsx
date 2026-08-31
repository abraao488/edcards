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
  searchParams: { subjectId?: string }
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const subjectId = searchParams.subjectId

  if (!subjectId) {
    return (
      <div className="py-20 text-center">
        <p className="text-muted-foreground">Matéria não especificada.</p>
      </div>
    )
  }

  const [subject, activeProfile, settings, queueCount] = await Promise.all([
    prisma.subject.findUnique({
      where: { id: subjectId },
    }),
    getOrCreateActiveProfile(user.id, user.email || ""),
    prisma.userSettings.findUnique({
      where: { userId: user.id },
    }),
    getReviewQueueCount(),
  ])

  if (!subject) {
    return (
      <div className="py-20 text-center">
        <p className="text-muted-foreground">Matéria não encontrada.</p>
      </div>
    )
  }

  const flashcards = await prisma.flashcard.findMany({
    where: {
      topic: { subjectId },
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
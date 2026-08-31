import { redirect } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { Sidebar } from "@/components/sidebar"
import { SubjectsAccordion } from "@/components/subjects-accordion"
import { SRSReviewSession } from "@/components/srs-review-session"
import { getReviewQueueCount } from "@/lib/flashcards/upcoming-actions"
import { EmptyState } from "@/components/empty-state"
import {
  getSubjectsWithTopicCounts,
  getTopicFlashcardsForQuiz,
} from "@/lib/materias/actions"
import { ArrowLeft, BookOpen, GraduationCap, Layers } from "lucide-react"

export const dynamic = "force-dynamic"

interface MateriasPageProps {
  searchParams: { topicId?: string }
}

export default async function MateriasPage({ searchParams }: MateriasPageProps) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const [dbUser, settings, queueCount] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
    }),
    prisma.userSettings.findUnique({
      where: { userId: user.id },
    }),
    getReviewQueueCount(),
  ])

  if (!dbUser) {
    redirect("/login")
  }

  const topicId = searchParams.topicId

  if (topicId) {
    const result = await getTopicFlashcardsForQuiz(dbUser.id, topicId)

    if (!result) {
      return (
        <div className="min-h-screen bg-background">
          <Sidebar email={dbUser.email} />
          <main className="pl-64 flex min-h-screen items-center justify-center p-8">
            <div className="w-full max-w-lg">
              <EmptyState
                icon={BookOpen}
                title="Assunto não encontrado"
                description="O assunto solicitado não existe ou foi removido."
                action={
                  <Link
                    href="/materias"
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/85"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Voltar para Matérias
                  </Link>
                }
              />
            </div>
          </main>
        </div>
      )
    }

    if (result.flashcards.length === 0) {
      return (
        <div className="min-h-screen bg-background">
          <Sidebar email={dbUser.email} />
          <main className="pl-64 flex min-h-screen items-center justify-center p-8">
            <div className="w-full max-w-lg">
              <EmptyState
                icon={Layers}
                title={`Nenhum flashcard em "${result.topic.name}"`}
                description="Este assunto ainda não tem cards na sua conta. Crie cards para ele ou escolha outro assunto."
                action={
                  <Link
                    href="/materias"
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/85"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Voltar para Matérias
                  </Link>
                }
              />
            </div>
          </main>
        </div>
      )
    }

    const formattedCards = result.flashcards.map((fc) => ({
      id: fc.id,
      currentCycleDay: fc.currentCycleDay,
      firstReviewAt: null,
      isCycleEnded: false,
      difficultyStage: "MEDIUM" as const,
      flashcard: {
        id: fc.id,
        front: fc.front,
        back: fc.back,
        topic: fc.topic
          ? {
              id: fc.topic.id,
              name: fc.topic.name,
              subject: {
                id: fc.topic.subject.id,
                name: fc.topic.subject.name,
              },
            }
          : null,
      },
    }))

    return (
      <SRSReviewSession
        initialProgressCards={formattedCards}
        userId={dbUser.id}
        email={dbUser.email}
        isQuizMode
        pomodoroMin={settings?.pomodoroMin ?? 25}
        initialQueueCount={queueCount}
      />
    )
  }

  const subjects = await getSubjectsWithTopicCounts(dbUser.id)

  return (
    <div className="min-h-screen bg-background">
      <Sidebar email={dbUser.email} />
      <main className="pl-64">
        <div className="relative p-8">
          <div className="pointer-events-none absolute right-0 top-0 h-64 w-64 rounded-full bg-primary/5 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 left-1/4 h-48 w-48 rounded-full bg-purple-500/5 blur-3xl" />

          <div className="relative mb-8">
            <div className="mb-2 flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary shadow-[0_0_15px_rgba(0,212,255,0.12)]">
                <GraduationCap className="h-6 w-6" />
              </div>
              <div>
                <p className="mb-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.25em] text-primary">
                  Seu acervo
                </p>
                <h1 className="text-4xl font-extrabold tracking-tighter text-foreground">
                  Matérias e Assuntos
                </h1>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  Crie matérias, organize assuntos e pratique flashcards.
                </p>
              </div>
            </div>
          </div>

          <SubjectsAccordion subjects={subjects} />
        </div>
      </main>
    </div>
  )
}
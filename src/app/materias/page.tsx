import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { Sidebar } from "@/components/sidebar"
import { SubjectsAccordion } from "@/components/subjects-accordion"
import { getSubjectsWithTopicCounts } from "@/lib/materias/actions"
import { GraduationCap } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function MateriasPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
  })

  if (!dbUser) {
    redirect("/login")
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
                  Crie matérias, organize assuntos e veja a quantidade de cards.
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
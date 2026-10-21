import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { requireActiveSubscriptionForPage } from "@/lib/subscription/guard"
import { getScheduleWithDetails } from "@/lib/schedule/actions"
import { Sidebar } from "@/components/sidebar"
import { EditalClient } from "./client"

export const dynamic = "force-dynamic"

export default async function EditalPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  // Recurso premium: o Edital Fechado carrega o cronograma salvo, e essa
  // leitura exige assinatura ativa. Redireciona para upgrade em vez de deixar
  // a Server Action lançar erro durante o render.
  await requireActiveSubscriptionForPage()

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
  })

  if (!dbUser) {
    redirect("/login")
  }

  // Cronograma já salvo (o mais recente). `getScheduleWithDetails` valida a
  // propriedade pelo usuário da sessão, então aqui basta o id.
  const existingSchedule = await prisma.studySchedule.findFirst({
    where: { userId: dbUser.id },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  })

  const scheduleDetails = existingSchedule
    ? await getScheduleWithDetails(existingSchedule.id)
    : null

  return (
    <div className="min-h-screen bg-background">
      <Sidebar email={dbUser.email} />
      <main className="pt-14 lg:pl-64 lg:pt-0">
        <div className="relative p-4 sm:p-6 lg:p-8">
          <div className="pointer-events-none absolute right-0 top-0 h-64 w-64 rounded-full bg-primary/5 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 left-1/3 h-48 w-48 rounded-full bg-purple-500/5 blur-3xl" />

          <EditalClient initialSchedule={scheduleDetails} />
        </div>
      </main>
    </div>
  )
}

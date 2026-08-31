import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { SubscriptionManager } from "@/components/subscription-manager"
import { SettingsPanel } from "@/components/settings-panel"
import { StatCard } from "@/components/stat-card"
import { Sidebar } from "@/components/sidebar"
import { ProfileManager } from "./client"
import { ProfileForm } from "@/components/profile-form"
import { getOrCreateActiveProfile } from "@/lib/profile/helpers"

export const dynamic = "force-dynamic"

export default async function ConfiguracoesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const [dbUser, settings, stats] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      include: { profiles: { orderBy: { createdAt: "asc" } }, subscription: true },
    }),
    prisma.userSettings.findUnique({ where: { userId: user.id } }),
    Promise.all([
      prisma.deck.count({ where: { userId: user.id } }),
      prisma.flashcard.count({
        where: { deck: { userId: user.id }, nextReview: { lte: new Date() } },
      }),
      prisma.document.count({ where: { userId: user.id } }),
      prisma.question.count({ where: { userId: user.id } }),
    ]),
  ])

  if (!dbUser) {
    redirect("/login")
  }

  const activeProfile = await getOrCreateActiveProfile(user.id, user.email || "")

  const [decks, cardsDue, materiaisCount, questoesCount] = stats

  const subStatus = dbUser.subscription
    ? {
        active: dbUser.subscription.status === "ACTIVE",
        status: dbUser.subscription.status,
        plan: dbUser.subscription.plan,
        paymentMethod: dbUser.subscription.paymentMethod,
        nextBillingDate: dbUser.subscription.nextBillingDate?.toISOString(),
      }
    : null

  return (
    <div className="min-h-screen bg-background">
      <Sidebar email={dbUser.email} />
      <main className="pl-64">
        <div className="relative p-8">
          <div className="pointer-events-none absolute right-0 top-0 h-64 w-64 rounded-full bg-primary/5 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 left-1/3 h-48 w-48 rounded-full bg-purple-500/5 blur-3xl" />

          <div className="max-w-2xl mx-auto">
            <h1 className="mb-8 text-3xl font-bold text-foreground">
              Configurações
            </h1>

            <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatCard label="Baralhos" value={decks} />
              <StatCard label="Cards para revisar" value={cardsDue} />
              <StatCard label="Materiais" value={materiaisCount} />
              <StatCard label="Questões" value={questoesCount} />
            </div>

            <div className="space-y-6">
              <ProfileForm
                avatarUrl={activeProfile.avatarUrl}
                name={activeProfile.name}
                concurrenceName={activeProfile.concurrenceName}
                email={dbUser.email}
                createdAt={dbUser.createdAt}
              />

              <ProfileManager
                profiles={dbUser.profiles}
                subscription={dbUser.subscription}
                activeProfileId={dbUser.activeProfileId}
              />

              <SettingsPanel
                aiEnabled={settings?.aiEnabled ?? true}
                pomodoroMin={settings?.pomodoroMin ?? 25}
                breakDuration={settings?.breakDuration ?? 5}
                concurrenceName={activeProfile.concurrenceName ?? ""}
              />

              <div>
                <h2 className="mb-4 text-lg font-semibold text-foreground">
                  Assinatura
                </h2>
                <SubscriptionManager sub={subStatus} />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

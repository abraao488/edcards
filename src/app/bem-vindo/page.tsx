import { redirect } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { SubscriptionManager } from "@/components/subscription-manager"
import { SubscriptionStatusSync } from "@/components/subscription-status-sync"
import { Sparkles, PartyPopper, ArrowRight } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function BemVindoPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    include: { subscription: true },
  })

  if (!dbUser) {
    redirect("/login")
  }

  const sub = dbUser.subscription
  const isActive = sub
    ? sub.status === "ACTIVE" ||
      (sub.accessExpiresAt !== null && sub.accessExpiresAt > new Date())
    : false

  const pendingWithPayment = !!(
    dbUser.subscription?.status === "PENDING" &&
    dbUser.subscription?.mercadopagoId
  )

  const subStatus = sub
    ? {
        active: isActive,
        status: sub.status,
        plan: sub.plan,
        paymentMethod: sub.paymentMethod,
        nextBillingDate: sub.nextBillingDate?.toISOString(),
        accessExpiresAt: sub.accessExpiresAt?.toISOString(),
      }
    : null

  return (
    <div className="min-h-screen bg-background">
      <SubscriptionStatusSync pendingWithPayment={pendingWithPayment} />
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute right-[-80px] top-[-80px] h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute bottom-[-40px] left-[10%] h-64 w-64 rounded-full bg-purple-500/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-2xl px-4 py-10 sm:py-14">
        {/* Header bem-vindo */}
        <div className="mb-8 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card p-6 sm:p-8">
          <div className="mb-3 flex items-center gap-2 text-primary">
            <PartyPopper className="h-6 w-6" />
            <span className="text-sm font-semibold uppercase tracking-wider">
              Conta criada com sucesso
            </span>
          </div>
          <h1 className="mb-2 flex items-center gap-2 text-2xl font-bold text-foreground sm:text-3xl">
            <Sparkles className="h-7 w-7 text-primary" />
            Bem-vindo ao Edcards!
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
            Sua conta foi criada{" "}
            <span className="font-medium text-foreground">{dbUser.email}</span>.
            Finalize seu acesso agora para liberar flashcards ilimitados, IA, SRS e
            todos os recursos — escolha abaixo a forma de pagamento.
          </p>
        </div>

        {/* Destaque de pagamento - já em tela sem precisar clicar em nada */}
        <div className="mb-4 flex items-center gap-2">
          <div className="h-px flex-1 bg-border" />
          <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
            Finalize seu acesso
          </span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <div className="rounded-2xl border-2 border-primary/30 bg-card p-1 shadow-[0_0_30px_rgba(0,212,255,0.08)]">
          <div className="rounded-xl bg-background p-4 sm:p-6">
            <SubscriptionManager sub={subStatus} />
          </div>
        </div>

        {isActive ? (
          <div className="mt-6 flex justify-center">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Ir para o dashboard <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <p className="mt-6 text-center text-xs text-muted-foreground">
            Pagamento seguro via Mercado Pago. Pix libera em segundos. Assinatura
            recorrente pode ser cancelada a qualquer momento.{" "}
            <Link
              href="/dashboard/configuracoes"
              className="text-primary hover:underline"
            >
              Ver detalhes em Configurações
            </Link>
            .
          </p>
        )}

        {!isActive && (
          <div className="mt-4 text-center">
            <Link
              href="/dashboard"
              className="text-xs text-muted-foreground hover:text-foreground hover:underline"
            >
              Continuar e decidir depois →
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

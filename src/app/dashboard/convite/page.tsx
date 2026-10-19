import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getMyInvite } from "@/lib/referral/actions"
import { ReferralPanel } from "@/components/referral-panel"

export const dynamic = "force-dynamic"

export default async function ConvitePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const invite = await getMyInvite()

  return (
    <div className="mx-auto max-w-2xl">
      <p className="mb-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.25em] text-primary">
        Crescimento
      </p>
      <h1 className="mb-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
        Convidar amigos
      </h1>
      <p className="mb-6 text-sm leading-relaxed text-muted-foreground sm:mb-8">
        Compartilhe o Edcards e ganhe acesso grátis a cada amigo que assinar.
      </p>

      <ReferralPanel invite={invite} />
    </div>
  )
}

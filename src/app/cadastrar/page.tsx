import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { Sidebar } from "@/components/sidebar"
import { CadastroForm } from "@/components/cadastro-form"
import { PlusCircle } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function CadastrarPage() {
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

  return (
    <div className="min-h-screen bg-background">
      <Sidebar email={dbUser.email} />
      <main className="pt-14 lg:pl-64 lg:pt-0">
        <div className="relative p-4 sm:p-6 lg:p-8">
          <div className="pointer-events-none absolute right-0 top-0 h-64 w-64 rounded-full bg-primary/5 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 left-1/3 h-48 w-48 rounded-full bg-purple-500/5 blur-3xl" />

          <div className="relative mb-6 flex items-start gap-3 sm:mb-8 sm:gap-4 animate-edcards-in">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary shadow-[0_0_15px_rgba(0,212,255,0.12)] sm:h-11 sm:w-11">
              <PlusCircle className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" />
            </div>
            <div>
              <p className="mb-1 font-mono text-[10px] font-semibold uppercase tracking-[0.25em] text-primary">Novo</p>
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Cadastrar Conteúdo
              </h1>
              <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">
                Matérias, assuntos e flashcards em um único fluxo de cadastro.
              </p>
            </div>
          </div>

          <CadastroForm />
        </div>
      </main>
    </div>
  )
}

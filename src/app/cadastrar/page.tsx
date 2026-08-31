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
      <main className="pl-64">
        <div className="relative p-8">
          <div className="pointer-events-none absolute right-0 top-0 h-64 w-64 rounded-full bg-primary/5 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 left-1/3 h-48 w-48 rounded-full bg-purple-500/5 blur-3xl" />

          <div className="relative mb-8">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary shadow-[0_0_15px_rgba(0,212,255,0.12)]">
                <PlusCircle className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-foreground">
                  Cadastrar Conteúdo
                </h1>
                <p className="text-sm text-muted-foreground">
                  Matérias, assuntos e flashcards em um único fluxo de cadastro.
                </p>
              </div>
            </div>
          </div>

          <CadastroForm />
        </div>
      </main>
    </div>
  )
}

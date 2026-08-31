import Link from "next/link"
import { ArrowLeft, Play } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { SimuladoEngine } from "@/components/simulado-engine"

export default async function SimuladoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const questions = await prisma.question.findMany({
    where: { userId: user.id },
    select: { id: true, statement: true, options: true, correctIndex: true, explanation: true },
  })

  const shuffled = [...questions].sort(() => Math.random() - 0.5)

  const serialized = shuffled.map((q) => ({
    ...q,
    options: q.options as string[],
  }))

  return (
    <div>
      <Link
        href="/dashboard/questoes"
        className="mb-6 flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>

      <div className="mb-8 flex items-center gap-3">
        <Play className="h-6 w-6 text-primary" />
        <h1 className="text-3xl font-bold text-foreground">Simulado</h1>
      </div>

      <SimuladoEngine questions={serialized} />
    </div>
  )
}

import { Trash2 } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { CreateQuestionDialog } from "@/components/create-question-dialog"
import { deleteQuestion } from "@/lib/questoes/actions"

const difficultyLabel: Record<string, string> = {
  EASY: "Fácil",
  MEDIUM: "Médio",
  HARD: "Difícil",
}

const difficultyColor: Record<string, string> = {
  EASY: "text-green-400",
  MEDIUM: "text-yellow-400",
  HARD: "text-red-400",
}

const letter = (i: number) => String.fromCharCode(65 + i)

export default async function QuestoesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const questions = await prisma.question.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  })

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground">Questões</h1>
        <CreateQuestionDialog />
      </div>

      {questions.length === 0 ? (
        <p className="text-muted-foreground">
          Nenhuma questão cadastrada. Crie sua primeira questão para começar.
        </p>
      ) : (
        <div className="space-y-4">
          {questions.map((q) => {
            const options = q.options as string[]
            return (
              <div
                key={q.id}
                className="rounded-xl border border-border bg-card p-5"
              >
                <div className="mb-3 flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-semibold text-foreground">{q.statement}</p>
                    <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{q.subject}</span>
                      <span className={difficultyColor[q.difficulty]}>
                        {difficultyLabel[q.difficulty]}
                      </span>
                    </div>
                  </div>
                  <form action={deleteQuestion.bind(null, q.id)}>
                    <button
                      type="submit"
                      className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </form>
                </div>

                <div className="space-y-1.5">
                  {options.map((opt, i) => (
                    <div
                      key={i}
                      className={`rounded-lg border px-3 py-2 text-sm ${
                        i === q.correctIndex
                          ? "border-green-500/30 bg-green-500/5 text-green-400"
                          : "border-border text-foreground"
                      }`}
                    >
                      <span className="mr-2 font-medium">{letter(i)}.</span>
                      {opt}
                    </div>
                  ))}
                </div>

                {q.explanation && (
                  <p className="mt-3 text-sm text-muted-foreground">
                    {q.explanation}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

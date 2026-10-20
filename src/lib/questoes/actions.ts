"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { requireActiveSubscriptionForAction } from "@/lib/subscription/guard"

export async function createQuestion(formData: FormData) {
  await requireActiveSubscriptionForAction()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const statement = formData.get("statement") as string
  const subject = formData.get("subject") as string
  const difficulty = formData.get("difficulty") as string
  const rawCorrectIndex = formData.get("correctIndex")
  const explanation = formData.get("explanation") as string

  const options = []
  for (let i = 0; i < 5; i++) {
    const opt = formData.get(`option_${i}`) as string
    if (opt) options.push(opt)
  }

  if (!statement || options.length < 2) {
    return { error: "Enunciado e ao menos 2 opções são obrigatórios" }
  }

  // Number() (instead of parseInt) rejects trailing garbage like "2abc" and
  // fractional values like "1.5". Empty/missing fields become NaN on purpose.
  const correctIndex =
    typeof rawCorrectIndex === "string" && rawCorrectIndex.trim() !== ""
      ? Number(rawCorrectIndex)
      : NaN

  if (!Number.isInteger(correctIndex)) {
    return { error: "Selecione a alternativa correta" }
  }

  if (correctIndex < 0 || correctIndex >= options.length) {
    return {
      error: `A alternativa correta deve estar entre 0 e ${options.length - 1}`,
    }
  }

  await prisma.question.create({
    data: {
      statement,
      options,
      correctIndex,
      explanation: explanation || null,
      subject,
      difficulty: difficulty as "EASY" | "MEDIUM" | "HARD",
      userId: user.id,
    },
  })

  revalidatePath("/dashboard/questoes")
}

export async function deleteQuestion(id: string) {
  await requireActiveSubscriptionForAction()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  await prisma.question.deleteMany({ where: { id, userId: user.id } })
  revalidatePath("/dashboard/questoes")
}

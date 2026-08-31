"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"

export async function createQuestion(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const statement = formData.get("statement") as string
  const subject = formData.get("subject") as string
  const difficulty = formData.get("difficulty") as string
  const correctIndex = parseInt(formData.get("correctIndex") as string)
  const explanation = formData.get("explanation") as string

  const options = []
  for (let i = 0; i < 5; i++) {
    const opt = formData.get(`option_${i}`) as string
    if (opt) options.push(opt)
  }

  if (!statement || options.length < 2) {
    return { error: "Enunciado e ao menos 2 opções são obrigatórios" }
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
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  await prisma.question.deleteMany({ where: { id, userId: user.id } })
  revalidatePath("/dashboard/questoes")
}

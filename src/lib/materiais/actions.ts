"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"

export async function uploadDocument(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const file = formData.get("file") as File
  const title = formData.get("title") as string
  const subject = formData.get("subject") as string

  if (!file || !title) return { error: "Arquivo e título são obrigatórios" }

  const ext = file.name.split(".").pop()
  const filePath = `${user.id}/${crypto.randomUUID()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from("documentos")
    .upload(filePath, file, {
      contentType: file.type,
      upsert: false,
    })

  if (uploadError) return { error: uploadError.message }

  await prisma.document.create({
    data: {
      title,
      fileUrl: filePath,
      subject: subject || null,
      userId: user.id,
    },
  })

  revalidatePath("/dashboard/materiais")
}

export async function deleteDocument(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const doc = await prisma.document.findUnique({ where: { id } })
  if (!doc || doc.userId !== user.id) throw new Error("Not found")

  await supabase.storage.from("documentos").remove([doc.fileUrl])
  await prisma.document.delete({ where: { id } })
  revalidatePath("/dashboard/materiais")
}

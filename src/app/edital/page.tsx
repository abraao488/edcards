import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { Sidebar } from "@/components/sidebar"
import { EditalClient } from "./client"

export const dynamic = "force-dynamic"

export default async function EditalPage() {
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

          <EditalClient />
        </div>
      </main>
    </div>
  )
}

import { createClient } from "@/lib/supabase/server"
import { Sidebar } from "@/components/sidebar"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="min-h-screen bg-background">
      <Sidebar email={user?.email} />
      <main className="pl-64">
        <div className="relative p-8">
          <div className="pointer-events-none absolute right-0 top-0 h-72 w-72 rounded-full bg-primary/[0.06] blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 left-1/3 h-56 w-56 rounded-full bg-purple-500/[0.05] blur-3xl" />
          <div className="relative">{children}</div>
        </div>
      </main>
    </div>
  )
}

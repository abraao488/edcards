"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  Home,
  BookOpen,
  Folder,
  PlusCircle,
  Brain,
  Sparkles,
  SlidersHorizontal,
  ClipboardList,
  Lock,
  Settings,
  LogOut,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"

const navItems = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: Home,
  },
  {
    label: "FlashCards",
    href: "/flashcards",
    icon: BookOpen,
  },
  {
    label: "Matérias/Assuntos",
    href: "/materias",
    icon: Folder,
  },
  {
    label: "Cadastrar Cards",
    href: "/cadastrar",
    icon: PlusCircle,
  },
  {
    label: "Criar com IA",
    href: "/criar-com-edcards",
    icon: Sparkles,
  },
  {
    label: "Organizar",
    href: "/organizar",
    icon: SlidersHorizontal,
  },
  {
    label: "Gerenciador",
    href: "/gerenciador",
    icon: ClipboardList,
  },
  {
    label: "Edital Fechado",
    href: "/edital",
    icon: Lock,
  },
  {
    label: "Configurações",
    href: "/dashboard/configuracoes",
    icon: Settings,
  },
]

export function Sidebar({ email }: { email?: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r border-border bg-card">
      <div className="flex h-16 items-center gap-2 border-b border-border px-6">
        <Brain className="h-8 w-8 text-primary" />
        <span className="text-xl font-bold text-foreground">Edcards</span>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/")
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary border-l-2 border-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground border-l-2 border-transparent"
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-border p-3">
        {email && (
          <p className="mb-2 truncate px-3 text-xs text-muted-foreground">
            {email}
          </p>
        )}
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <LogOut className="h-5 w-5" />
          Sair
        </button>
      </div>
    </aside>
  )
}

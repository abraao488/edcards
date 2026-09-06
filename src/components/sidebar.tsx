"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useState } from "react"
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
  Menu,
  X,
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
  const [mobileOpen, setMobileOpen] = useState(false)

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  return (
    <>
      {/* Mobile top bar — visible < lg, não interfere em desktop */}
      <div className="fixed left-0 right-0 top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-card/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-card/90 lg:hidden">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Brain className="h-7 w-7 text-primary" aria-hidden="true" />
          <span className="text-lg font-bold tracking-tight text-foreground">Edcards</span>
        </Link>
        <button
          onClick={() => setMobileOpen((v) => !v)}
          aria-label={mobileOpen ? "Fechar menu" : "Abrir menu"}
          aria-expanded={mobileOpen}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-secondary text-foreground transition-colors duration-200 hover:bg-secondary/80 active:scale-[0.98]"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Backdrop mobile */}
      {mobileOpen && (
        <button
          aria-label="Fechar menu"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-30 bg-black/45 backdrop-blur-[1px] lg:hidden"
        />
      )}

      <aside
        className={cn(
          "fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r border-border bg-card transition-transform duration-200 ease-out lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          "max-lg:top-14 max-lg:h-[calc(100vh-3.5rem)] max-lg:shadow-xl"
        )}
      >
        <div className="hidden h-16 items-center gap-2 border-b border-border px-6 lg:flex">
          <Brain className="h-8 w-8 text-primary" aria-hidden="true" />
          <span className="text-xl font-bold tracking-tight text-foreground">Edcards</span>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + "/")
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ease-out active:scale-[0.98]",
                  isActive
                    ? "bg-primary/10 text-primary ring-1 ring-primary/20"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                <item.icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
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
            className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-all duration-200 hover:bg-secondary hover:text-foreground active:scale-[0.98]"
          >
            <LogOut className="h-[18px] w-[18px]" aria-hidden="true" />
            Sair
          </button>
        </div>
      </aside>
    </>
  )
}

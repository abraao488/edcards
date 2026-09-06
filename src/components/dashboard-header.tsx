"use client"

import { useState } from "react"
import Image from "next/image"
import { Settings, LogOut, User, ChevronDown } from "lucide-react"

interface DashboardHeaderProps {
  name: string
  avatarUrl: string | null
  concurrence: string | null
  email: string | null
}

export function DashboardHeader({
  name,
  avatarUrl,
  concurrence,
  email,
}: DashboardHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="mb-6 flex flex-col gap-4 sm:mb-10 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p className="mb-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.25em] text-primary sm:text-[11px]">
          Painel
        </p>
        <h1 className="text-3xl font-extrabold tracking-tighter text-foreground sm:text-4xl">
          Dashboard
          {concurrence && (
            <span className="ml-2 text-base font-medium tracking-normal text-muted-foreground sm:text-xl">
              , {concurrence}
            </span>
          )}
        </h1>
        <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted-foreground">
          Acompanhe seu progresso de estudos e mantenha a sequência ativa
        </p>
      </div>

      <div className="relative self-start sm:self-auto">
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="flex w-full items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5 transition-all duration-200 hover:border-foreground/15 hover:bg-secondary sm:w-auto sm:px-4 active:scale-[0.98]"
          aria-label="Abrir menu do usuário"
          aria-expanded={menuOpen}
        >
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt={name}
              width={40}
              height={40}
              className="h-10 w-10 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 text-sm font-bold text-primary">
              {name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="text-left">
            <p className="text-sm font-semibold text-foreground">{name}</p>
            <p className="font-mono text-[11px] text-muted-foreground">{email}</p>
          </div>
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform ${menuOpen ? "rotate-180" : ""}`}
          />
        </button>

        {menuOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setMenuOpen(false)}
            />
            <div className="absolute right-0 top-full z-50 mt-2 w-48 overflow-hidden rounded-xl border border-border bg-popover/95 shadow-xl backdrop-blur-sm">
              <div className="p-1">
                <a
                  href="/dashboard/configuracoes"
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover:bg-secondary"
                >
                  <User className="h-4 w-4" />
                  Perfil
                </a>
                <a
                  href="/dashboard/configuracoes"
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover:bg-secondary"
                >
                  <Settings className="h-4 w-4" />
                  Configurações
                </a>
                <div className="my-1 h-px bg-border" />
                <button
                  onClick={() => {
                    window.location.href = "/api/auth/logout"
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-400 transition-colors hover:bg-red-500/10"
                >
                  <LogOut className="h-4 w-4" />
                  Sair
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </header>
  )
}

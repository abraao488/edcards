"use client"

import { useState } from "react"
import { updateProfile } from "@/lib/profile/actions"
import { Mail, Calendar, User } from "lucide-react"

interface ProfileFormProps {
  avatarUrl: string | null
  name: string | null
  concurrenceName: string | null
  email: string
  createdAt: Date
}

export function ProfileForm({
  avatarUrl,
  name,
  concurrenceName,
  email,
  createdAt,
}: ProfileFormProps) {
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSaved(false)

    try {
      const formData = new FormData(e.currentTarget)
      await updateProfile(formData)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      console.error("Erro ao salvar perfil:", err)
      setError(
        err instanceof Error ? err.message : "Erro ao salvar perfil."
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <h2 className="mb-4 text-lg font-semibold text-foreground">
        Perfil e Dados Cadastrais
      </h2>

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center gap-4 mb-4">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={name || "Avatar"}
              className="w-16 h-16 rounded-full object-cover border border-border"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center border border-border">
              <User className="w-8 h-8 text-primary" />
            </div>
          )}
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium text-foreground" htmlFor="avatarUrl">
              URL do Avatar
            </label>
            <input
              id="avatarUrl"
              name="avatarUrl"
              defaultValue={avatarUrl || ""}
              className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="https://exemplo.com/avatar.jpg"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-foreground" htmlFor="name">
            Nome
          </label>
          <input
            id="name"
            name="name"
            defaultValue={name || ""}
            className="w-full rounded-lg border border-border bg-secondary px-4 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="Seu nome"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-foreground" htmlFor="concurrenceName">
            Concurso de Interesse
          </label>
          <input
            id="concurrenceName"
            name="concurrenceName"
            defaultValue={concurrenceName || ""}
            className="w-full rounded-lg border border-border bg-secondary px-4 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="Ex: TSE 2026, MPU, etc."
          />
        </div>

        <div className="flex items-center gap-3 text-sm">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Email:</span>
          <span className="text-foreground">{email}</span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Membro desde:</span>
          <span className="text-foreground">
            {new Date(createdAt).toLocaleDateString("pt-BR")}
          </span>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="mt-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? "Salvando..." : saved ? "Salvo!" : "Salvar Alterações"}
        </button>
      </form>
    </div>
  )
}

"use client"

import { useState } from "react"
import { User, Plus, CheckCircle2 } from "lucide-react"
import { Profile, Subscription } from "@prisma/client"
import { switchProfile, createProfile } from "@/lib/profile/actions"

interface ProfileManagerProps {
  profiles: Profile[]
  subscription: Subscription | null
  activeProfileId: string | null
}

export function ProfileManager({
  profiles,
  subscription,
  activeProfileId,
}: ProfileManagerProps) {
  const [newProfileName, setNewProfileName] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [switchingId, setSwitchingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const maxProfiles =
    subscription?.plan === "GRUPO" ? 5 : subscription?.plan === "DUPLA" ? 2 : 1

  const canCreateProfile = profiles.length < maxProfiles

  const handleSwitchProfile = async (profileId: string) => {
    setSwitchingId(profileId)
    setError(null)
    try {
      await switchProfile(profileId)
    } catch (err) {
      console.error("Erro ao trocar perfil:", err)
      setError(
        err instanceof Error ? err.message : "Erro ao trocar perfil."
      )
    } finally {
      setSwitchingId(null)
    }
  }

  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newProfileName.trim()) return
    setIsCreating(true)
    setError(null)
    try {
      await createProfile(newProfileName.trim())
      setNewProfileName("")
    } catch (err) {
      console.error("Erro ao criar perfil:", err)
      setError(
        err instanceof Error ? err.message : "Erro ao criar perfil."
      )
    } finally {
      setIsCreating(false)
    }
  }

  const getPlanLabel = () => {
    switch (subscription?.plan) {
      case "INDIVIDUAL":
        return { name: "Individual", price: "R$ 15,00", max: 1 }
      case "DUPLA":
        return { name: "Em Dupla", price: "R$ 25,00", max: 2 }
      case "GRUPO":
        return { name: "Em Grupo", price: "R$ 50,00", max: 5 }
      default:
        return { name: "Individual", price: "R$ 15,00", max: 1 }
    }
  }

  const planLabel = getPlanLabel()

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <h2 className="mb-4 text-lg font-semibold text-foreground">
        Gerenciamento de Perfis da Conta
      </h2>

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="mb-4 text-sm text-muted-foreground">
        <p>
          Plano atual:{" "}
          <span className="font-medium text-primary">{planLabel.name}</span> (
          {planLabel.price})
        </p>
        {subscription?.plan === "INDIVIDUAL" && (
          <p className="mt-1">
            Seu plano permite 1 perfil ativo. Faça upgrade para adicionar mais
            pessoas.
          </p>
        )}
      </div>

      <div className="space-y-3 mb-6">
        {profiles.map((profile) => (
          <div
            key={profile.id}
            className={`p-4 rounded-lg border flex items-center justify-between ${
              profile.id === activeProfileId
                ? "border-primary bg-primary/5"
                : "border-border"
            }`}
          >
            <div className="flex items-center gap-3">
              {profile.avatarUrl ? (
                <img
                  src={profile.avatarUrl}
                  alt={profile.name || "Avatar"}
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <User className="w-5 h-5 text-primary" />
                </div>
              )}
              <div>
                <p className="font-medium text-foreground">
                  {profile.name || "Usuário"}
                </p>
                {profile.concurrenceName && (
                  <p className="text-xs text-muted-foreground">
                    {profile.concurrenceName}
                  </p>
                )}
              </div>
            </div>
            {profile.id === activeProfileId ? (
              <span className="flex items-center gap-1 text-primary text-sm font-medium">
                <CheckCircle2 className="w-4 h-4" />
                Ativo
              </span>
            ) : (
              <button
                onClick={() => handleSwitchProfile(profile.id)}
                disabled={switchingId !== null}
                className="px-3 py-1 rounded-lg bg-primary/10 text-primary text-sm hover:bg-primary/20 disabled:opacity-50"
              >
                {switchingId === profile.id ? "Ativando..." : "Usar perfil"}
              </button>
            )}
          </div>
        ))}
      </div>

      {canCreateProfile && (
        <form onSubmit={handleCreateProfile} className="flex gap-2">
          <input
            type="text"
            value={newProfileName}
            onChange={(e) => setNewProfileName(e.target.value)}
            placeholder="Nome do novo perfil"
            className="flex-1 rounded-lg border border-border bg-secondary px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            type="submit"
            disabled={!newProfileName.trim() || isCreating}
            className="flex items-center gap-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="w-4 h-4" />
            {isCreating ? "Criando..." : "Criar"}
          </button>
        </form>
      )}
    </div>
  )
}

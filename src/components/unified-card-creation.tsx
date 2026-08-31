"use client"

import { useState, useEffect } from "react"
import { Plus, BookOpen, Layers, CreditCard } from "lucide-react"
import {
  createSubject,
  createTopic,
  getSubjectsWithTopics,
} from "@/lib/subjects/actions"
import { createCardWithSubject } from "@/lib/flashcards/create-actions"

type Tab = "subject" | "topic" | "flashcard"

interface SubjectWithTopics {
  id: string
  name: string
  topics: { id: string; name: string }[]
}

export function UnifiedCardCreation() {
  const [activeTab, setActiveTab] = useState<Tab>("flashcard")
  const [subjects, setSubjects] = useState<SubjectWithTopics[]>([])
  const [subjectName, setSubjectName] = useState("")
  const [topicName, setTopicName] = useState("")
  const [selectedSubjectId, setSelectedSubjectId] = useState("")
  const [cardFront, setCardFront] = useState("")
  const [cardBack, setCardBack] = useState("")
  const [cardSubjectId, setCardSubjectId] = useState("")
  const [cardType, setCardType] = useState<"BASIC" | "REVERSED" | "CLOZE">("BASIC")
  const [success, setSuccess] = useState("")

  useEffect(() => {
    loadSubjects()
  }, [])

  async function loadSubjects() {
    const data = await getSubjectsWithTopics()
    setSubjects(data)
  }

  const selectedSubject = subjects.find((s) => s.id === cardSubjectId)

  async function handleCreateSubject() {
    if (!subjectName.trim()) return
    await createSubject(subjectName)
    setSubjectName("")
    setSuccess("Matéria criada!")
    setTimeout(() => setSuccess(""), 2000)
    await loadSubjects()
  }

  async function handleCreateTopic() {
    if (!topicName.trim() || !selectedSubjectId) return
    await createTopic(selectedSubjectId, topicName)
    setTopicName("")
    setSuccess("Assunto criado!")
    setTimeout(() => setSuccess(""), 2000)
    await loadSubjects()
  }

  async function handleCreateFlashcard() {
    const isValid = (() => {
      if (!cardFront.trim()) return false
      if (cardType !== "CLOZE" && !cardBack.trim()) return false
      return true
    })()

    if (!isValid) return

    await createCardWithSubject(
      cardFront,
      cardBack,
      cardSubjectId || undefined,
      cardType
    )
    setCardFront("")
    setCardBack("")
    setSuccess("Flashcard criado!")
    setTimeout(() => setSuccess(""), 2000)
  }

  const tabs = [
    { id: "subject" as Tab, label: "Matéria", icon: BookOpen },
    { id: "topic" as Tab, label: "Assunto", icon: Layers },
    { id: "flashcard" as Tab, label: "Flashcard", icon: CreditCard },
  ]

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <h2 className="mb-6 text-xl font-bold text-foreground">
        Cadastro Unificado
      </h2>

      {success && (
        <div className="mb-4 rounded-lg bg-green-500/10 p-3 text-sm text-green-400">
          {success}
        </div>
      )}

      <div className="mb-6 flex gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "subject" && (
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">
              Nome da Matéria
            </label>
            <input
              value={subjectName}
              onChange={(e) => setSubjectName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateSubject()}
              placeholder="Ex: Direito Constitucional"
              className="w-full rounded-lg border border-border bg-secondary px-4 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <button
            onClick={handleCreateSubject}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> Criar Matéria
          </button>
        </div>
      )}

      {activeTab === "topic" && (
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">
              Matéria
            </label>
            <select
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              className="w-full rounded-lg border border-border bg-secondary px-4 py-2 text-foreground"
            >
              <option value="">Selecione a matéria...</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">
              Nome do Assunto
            </label>
            <input
              value={topicName}
              onChange={(e) => setTopicName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateTopic()}
              placeholder="Ex: Princípios Fundamentais"
              className="w-full rounded-lg border border-border bg-secondary px-4 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <button
            onClick={handleCreateTopic}
            disabled={!selectedSubjectId}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> Criar Assunto
          </button>
        </div>
      )}

      {activeTab === "flashcard" && (
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">
              Matéria (opcional)
            </label>
            <select
              value={cardSubjectId}
              onChange={(e) => setCardSubjectId(e.target.value)}
              className="w-full rounded-lg border border-border bg-secondary px-4 py-2 text-foreground"
            >
              <option value="">Selecione a matéria...</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {selectedSubject && selectedSubject.topics.length > 0 && (
            <div className="rounded-lg bg-secondary/50 p-3 text-sm text-muted-foreground">
              Assuntos disponíveis: {selectedSubject.topics.map((t) => t.name).join(", ")}
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">
              Tipo de Cartão
            </label>
            <select
              value={cardType}
              onChange={(e) => setCardType(e.target.value as "BASIC" | "REVERSED" | "CLOZE")}
              className="w-full rounded-lg border border-border bg-secondary px-4 py-2 text-foreground"
            >
              <option value="BASIC">Básico (Frente/Verso)</option>
              <option value="REVERSED">Básico + Cartão Invertido</option>
              <option value="CLOZE">Omissão de Palavras (Cloze)</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">
              {cardType === "CLOZE" ? "Texto com Omissão" : "Pergunta (Frente)"}
            </label>
            <textarea
              value={cardFront}
              onChange={(e) => setCardFront(e.target.value)}
              placeholder={
                cardType === "CLOZE"
                  ? "Ex: A CF foi promulgada em {{c1::1988}}."
                  : "Ex: Qual é o princípio da legalidade?"
              }
              rows={3}
              className="w-full rounded-lg border border-border bg-secondary px-4 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {cardType === "CLOZE" && (
            <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/5 p-3 text-sm">
              <p className="font-medium text-cyan-400 mb-1">Dica para Cloze</p>
              <p className="text-cyan-300/90">
                Use <code className="rounded bg-cyan-500/20 px-1 text-cyan-200">{`{{c1::palavra}}`}</code> para marcar a palavra que você quer omitir.
              </p>
            </div>
          )}

          {cardType !== "CLOZE" && (
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">
                Resposta (Verso)
              </label>
              <textarea
                value={cardBack}
                onChange={(e) => setCardBack(e.target.value)}
                placeholder="Ex: Ninguém será obrigado a fazer ou deixar de fazer..."
                rows={3}
                className="w-full rounded-lg border border-border bg-secondary px-4 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          )}

          <button
            onClick={handleCreateFlashcard}
            disabled={
              !cardFront.trim() ||
              (cardType !== "CLOZE" && !cardBack.trim())
            }
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> Criar Flashcard
          </button>
        </div>
      )}
    </div>
  )
}

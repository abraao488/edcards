"use client"

import { useCallback, useEffect, useState } from "react"
import {
  BookOpen,
  CheckCircle2,
  CreditCard,
  Layers,
  Loader2,
  Plus,
  X,
} from "lucide-react"
import { createSubject, createTopic, getSubjectsWithTopics } from "@/lib/subjects/actions"
import { createFlashcardWithTopic } from "@/lib/cadastrar/actions"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

type TabId = "subject" | "topic" | "flashcard"

interface SubjectOption {
  id: string
  name: string
  topics: { id: string; name: string }[]
}

interface ToastState {
  message: string
  type: "success" | "error"
}

const tabs: { id: TabId; label: string; step: string; icon: typeof BookOpen }[] = [
  { id: "subject", label: "Cadastrar Matéria", step: "1", icon: BookOpen },
  { id: "topic", label: "Cadastrar Assunto", step: "2", icon: Layers },
  { id: "flashcard", label: "Cadastrar Flashcards", step: "3", icon: CreditCard },
]

const selectTriggerClass =
  "h-11 w-full border-border bg-secondary/35 px-3 text-foreground transition-all focus-visible:border-primary/50 focus-visible:ring-primary/20 hover:border-primary/30"

export function CadastroForm() {
  const [activeTab, setActiveTab] = useState<TabId>("subject")
  const [subjects, setSubjects] = useState<SubjectOption[]>([])
  const [loadingSubjects, setLoadingSubjects] = useState(true)
  const [toast, setToast] = useState<ToastState | null>(null)

  const [subjectName, setSubjectName] = useState("")
  const [savingSubject, setSavingSubject] = useState(false)

  const [topicName, setTopicName] = useState("")
  const [topicSubjectId, setTopicSubjectId] = useState("")
  const [savingTopic, setSavingTopic] = useState(false)

  const [cardFront, setCardFront] = useState("")
  const [cardBack, setCardBack] = useState("")
  const [cardSubjectId, setCardSubjectId] = useState("")
  const [cardTopicId, setCardTopicId] = useState("")
  const [cardType, setCardType] = useState<"BASIC" | "REVERSED" | "CLOZE">("BASIC")
  const [savingCard, setSavingCard] = useState(false)

  const showToast = useCallback((message: string, type: ToastState["type"] = "success") => {
    setToast({ message, type })
    window.setTimeout(() => setToast(null), 3500)
  }, [])

  const loadSubjects = useCallback(async () => {
    setLoadingSubjects(true)
    try {
      const data = await getSubjectsWithTopics()
      setSubjects(data)
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Erro ao carregar matérias.",
        "error"
      )
    } finally {
      setLoadingSubjects(false)
    }
  }, [showToast])

  useEffect(() => {
    loadSubjects()
  }, [loadSubjects])

  const topicsForSelectedSubject = subjects.find((s) => s.id === cardSubjectId)?.topics ?? []

  async function handleCreateSubject() {
    if (!subjectName.trim() || savingSubject) return
    setSavingSubject(true)
    try {
      await createSubject(subjectName)
      setSubjectName("")
      showToast("Matéria cadastrada com sucesso!")
      await loadSubjects()
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Erro ao salvar matéria.", "error")
    } finally {
      setSavingSubject(false)
    }
  }

  async function handleCreateTopic() {
    if (!topicName.trim() || !topicSubjectId || savingTopic) return
    setSavingTopic(true)
    try {
      await createTopic(topicSubjectId, topicName)
      setTopicName("")
      showToast("Assunto cadastrado com sucesso!")
      await loadSubjects()
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Erro ao salvar assunto.", "error")
    } finally {
      setSavingTopic(false)
    }
  }

  async function handleCreateFlashcard() {
    const isValid = (() => {
      if (!cardFront.trim() || !cardTopicId || savingCard) return false
      if (cardType !== "CLOZE" && !cardBack.trim()) return false
      return true
    })()

    if (!isValid) return

    setSavingCard(true)
    try {
      await createFlashcardWithTopic(cardFront, cardBack, cardTopicId, cardType)
      setCardFront("")
      setCardBack("")
      showToast("Flashcard salvo com sucesso!")
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Erro ao salvar flashcard.", "error")
    } finally {
      setSavingCard(false)
    }
  }

  function handleCardSubjectChange(value: string | null) {
    const nextSubjectId = value ?? ""
    setCardSubjectId(nextSubjectId)
    setCardTopicId("")
  }

  return (
    <>
      {toast && (
        <div
          className={cn(
            "fixed bottom-6 right-6 z-50 flex max-w-sm items-start gap-3 rounded-xl border px-4 py-3 shadow-[0_0_25px_rgba(0,212,255,0.12)] animate-in slide-in-from-bottom-4 fade-in duration-300",
            toast.type === "success"
              ? "border-emerald-500/30 bg-card text-emerald-400"
              : "border-rose-500/30 bg-card text-rose-400"
          )}
        >
          {toast.type === "success" ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          ) : (
            <X className="mt-0.5 h-5 w-5 shrink-0" />
          )}
          <p className="text-sm font-medium leading-snug">{toast.message}</p>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="ml-auto text-muted-foreground hover:text-foreground"
            aria-label="Fechar notificação"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_0_30px_rgba(0,212,255,0.05)]">
        <div className="border-b border-border/60 bg-secondary/15 p-2">
          <div className="grid gap-2 md:grid-cols-3">
            {tabs.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-all duration-300",
                    isActive
                      ? "border border-primary/35 bg-primary/10 text-primary shadow-[0_0_18px_rgba(0,229,255,0.12)]"
                      : "border border-transparent text-muted-foreground hover:border-border hover:bg-secondary/40 hover:text-foreground"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold",
                      isActive ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"
                    )}
                  >
                    {tab.step}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="truncate text-sm font-semibold">{tab.label}</span>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <div className="relative p-6 sm:p-8">
          <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary/5 blur-3xl" />

          {activeTab === "subject" && (
            <div className="relative space-y-5">
              <div>
                <h2 className="text-lg font-bold text-foreground">Nova Matéria</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Crie uma matéria para organizar seus assuntos de estudo.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="subject-name">Nome da matéria</Label>
                <Input
                  id="subject-name"
                  value={subjectName}
                  onChange={(e) => setSubjectName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreateSubject()}
                  placeholder='Ex: "Direito Constitucional"'
                  disabled={savingSubject}
                  className="h-11 border-border bg-secondary/35 px-4 focus-visible:border-primary/50 focus-visible:ring-primary/20"
                />
              </div>

              <button
                type="button"
                onClick={handleCreateSubject}
                disabled={!subjectName.trim() || savingSubject}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition-all hover:shadow-[0_0_20px_rgba(0,229,255,0.35)] disabled:opacity-50"
              >
                {savingSubject ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Salvar Matéria
                  </>
                )}
              </button>
            </div>
          )}

          {activeTab === "topic" && (
            <div className="relative space-y-5">
              <div>
                <h2 className="text-lg font-bold text-foreground">Novo Assunto</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Vincule o assunto a uma matéria já cadastrada.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Matéria vinculada</Label>
                <Select
                  value={topicSubjectId || null}
                  onValueChange={(value) => setTopicSubjectId(value ?? "")}
                  disabled={loadingSubjects || savingTopic}
                >
                  <SelectTrigger className={selectTriggerClass}>
                    <SelectValue placeholder="Selecione a matéria..." />
                  </SelectTrigger>
                  <SelectContent className="border-border bg-card">
                    {subjects.map((subject) => (
                      <SelectItem key={subject.id} value={subject.id}>
                        {subject.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="topic-name">Nome do assunto</Label>
                <Input
                  id="topic-name"
                  value={topicName}
                  onChange={(e) => setTopicName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreateTopic()}
                  placeholder='Ex: "Artigo 5º e Direitos Individuais"'
                  disabled={savingTopic}
                  className="h-11 border-border bg-secondary/35 px-4 focus-visible:border-primary/50 focus-visible:ring-primary/20"
                />
              </div>

              <button
                type="button"
                onClick={handleCreateTopic}
                disabled={!topicName.trim() || !topicSubjectId || savingTopic}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition-all hover:shadow-[0_0_20px_rgba(0,229,255,0.35)] disabled:opacity-50"
              >
                {savingTopic ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Salvar Assunto
                  </>
                )}
              </button>
            </div>
          )}

          {activeTab === "flashcard" && (
            <div className="relative space-y-5">
              <div>
                <h2 className="text-lg font-bold text-foreground">Novo Flashcard</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  O card será vinculado ao assunto e inicializado no seu perfil ativo.
                </p>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Matéria</Label>
                  <Select
                    value={cardSubjectId || null}
                    onValueChange={handleCardSubjectChange}
                    disabled={loadingSubjects || savingCard}
                  >
                    <SelectTrigger className={selectTriggerClass}>
                      <SelectValue placeholder="Selecione a matéria..." />
                    </SelectTrigger>
                    <SelectContent className="border-border bg-card">
                      {subjects.map((subject) => (
                        <SelectItem key={subject.id} value={subject.id}>
                          {subject.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Assunto</Label>
                  <Select
                    value={cardTopicId || null}
                    onValueChange={(value) => setCardTopicId(value ?? "")}
                    disabled={
                      !cardSubjectId ||
                      topicsForSelectedSubject.length === 0 ||
                      savingCard
                    }
                  >
                    <SelectTrigger className={selectTriggerClass}>
                      <SelectValue
                        placeholder={
                          !cardSubjectId
                            ? "Selecione uma matéria primeiro..."
                            : topicsForSelectedSubject.length === 0
                              ? "Nenhum assunto nesta matéria"
                              : "Selecione o assunto..."
                        }
                      />
                    </SelectTrigger>
                    <SelectContent className="border-border bg-card">
                      {topicsForSelectedSubject.map((topic) => (
                        <SelectItem key={topic.id} value={topic.id}>
                          {topic.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Tipo de Cartão</Label>
                <Select
                  value={cardType}
                  onValueChange={(value) => setCardType(value as "BASIC" | "REVERSED" | "CLOZE")}
                  disabled={savingCard}
                >
                  <SelectTrigger className={selectTriggerClass}>
                    <SelectValue placeholder="Selecione o tipo de cartão..." />
                  </SelectTrigger>
                  <SelectContent className="border-border bg-card">
                    <SelectItem value="BASIC">Básico (Frente/Verso)</SelectItem>
                    <SelectItem value="REVERSED">Básico + Cartão Invertido</SelectItem>
                    <SelectItem value="CLOZE">Omissão de Palavras (Cloze)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="card-front">
                  {cardType === "CLOZE" ? "Texto com Omissão" : "Pergunta"}
                </Label>
                <Textarea
                  id="card-front"
                  value={cardFront}
                  onChange={(e) => setCardFront(e.target.value)}
                  placeholder={
                    cardType === "CLOZE"
                      ? "Ex: A CF foi promulgada em {{c1::1988}}."
                      : "Digite a pergunta do flashcard..."
                  }
                  rows={5}
                  disabled={savingCard}
                  className="min-h-[140px] resize-y border-border bg-secondary/35 px-4 py-3 text-base focus-visible:border-primary/50 focus-visible:ring-primary/20"
                />
              </div>

              {cardType === "CLOZE" && (
                <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-4 shadow-[0_0_20px_rgba(6,182,212,0.1)]">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 h-6 w-6 shrink-0 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-400">
                      ?
                    </div>
                    <div>
                      <p className="text-sm font-medium text-cyan-400 mb-1">
                        Dica para Cloze
                      </p>
                      <p className="text-sm text-cyan-300/90">
                        Use <code className="rounded bg-cyan-500/20 px-1 text-cyan-200">{`{{c1::palavra}}`}</code> para marcar a palavra que você quer omitir. Você pode usar múltiplos marcadores com números sequenciais (c1, c2, c3...).
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {cardType !== "CLOZE" && (
                <div className="space-y-2">
                  <Label htmlFor="card-back">Resposta / Gabarito</Label>
                  <Textarea
                    id="card-back"
                    value={cardBack}
                    onChange={(e) => setCardBack(e.target.value)}
                    placeholder="Digite a resposta correta ou gabarito..."
                    rows={5}
                    disabled={savingCard}
                    className="min-h-[140px] resize-y border-border bg-secondary/35 px-4 py-3 text-base focus-visible:border-primary/50 focus-visible:ring-primary/20"
                  />
                </div>
              )}

              <button
                type="button"
                onClick={handleCreateFlashcard}
                disabled={
                  !cardFront.trim() ||
                  (cardType !== "CLOZE" && !cardBack.trim()) ||
                  !cardTopicId ||
                  savingCard
                }
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition-all hover:shadow-[0_0_20px_rgba(0,229,255,0.35)] disabled:opacity-50"
              >
                {savingCard ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Salvar Card
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

"use client"

import React, { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ChevronDown,
  ChevronUp,
  Folder,
  BookOpen,
  PlayCircle,
  Plus,
  Trash2,
  CheckCircle,
  AlertCircle,
  X,
} from "lucide-react"
import {
  createSubject,
  createTopic,
  deleteSubject,
  deleteTopic,
} from "@/lib/subjects/actions"
import { EmptyState } from "@/components/empty-state"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"

interface TopicWithCount {
  id: string
  name: string
  _count: {
    flashcards: number
  }
}

interface SubjectWithTopics {
  id: string
  name: string
  topics: TopicWithCount[]
}

interface SubjectsAccordionProps {
  subjects: SubjectWithTopics[]
}

interface ToastState {
  message: string
  type: "success" | "error"
}

interface ConfirmDeleteSubjectState {
  open: boolean
  subjectId: string
  subjectName: string
}

interface ConfirmDeleteTopicState {
  open: boolean
  topicId: string
  topicName: string
}

export function SubjectsAccordion({ subjects }: SubjectsAccordionProps) {
  const router = useRouter()
  const [localSubjects, setLocalSubjects] = useState<SubjectWithTopics[]>(subjects)
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<ToastState | null>(null)

  const [newSubjectName, setNewSubjectName] = useState("")
  const [newTopicNames, setNewTopicNames] = useState<Record<string, string>>({})

  const [confirmDeleteSubject, setConfirmDeleteSubject] =
    useState<ConfirmDeleteSubjectState>({
      open: false,
      subjectId: "",
      subjectName: "",
    })

  const [confirmDeleteTopic, setConfirmDeleteTopic] =
    useState<ConfirmDeleteTopicState>({
      open: false,
      topicId: "",
      topicName: "",
    })

  useEffect(() => {
    setLocalSubjects(subjects)
  }, [subjects])

  const showToast = useCallback(
    (message: string, type: ToastState["type"] = "success") => {
      setToast({ message, type })
      window.setTimeout(() => setToast(null), 3500)
    },
    []
  )

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }))
  }

  async function handleCreateSubject() {
    if (!newSubjectName.trim()) return
    setSaving(true)
    try {
      await createSubject(newSubjectName)
      setNewSubjectName("")
      router.refresh()
      showToast("Matéria criada com sucesso!")
    } catch (err) {
      console.error("Erro ao criar matéria:", err)
      showToast(
        err instanceof Error ? err.message : "Erro ao criar matéria",
        "error"
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleCreateTopic(subjectId: string) {
    const name = newTopicNames[subjectId] || ""
    if (!name.trim()) return
    setSaving(true)
    try {
      await createTopic(subjectId, name)
      setNewTopicNames((prev) => ({ ...prev, [subjectId]: "" }))
      setExpandedIds((prev) => ({ ...prev, [subjectId]: true }))
      router.refresh()
      showToast("Assunto criado com sucesso!")
    } catch (err) {
      console.error("Erro ao criar assunto:", err)
      showToast(
        err instanceof Error ? err.message : "Erro ao criar assunto",
        "error"
      )
    } finally {
      setSaving(false)
    }
  }

  function openConfirmDeleteSubject(id: string, name: string, e: React.MouseEvent) {
    e.stopPropagation()
    setConfirmDeleteSubject({ open: true, subjectId: id, subjectName: name })
  }

  function openConfirmDeleteTopic(id: string, name: string) {
    setConfirmDeleteTopic({ open: true, topicId: id, topicName: name })
  }

  async function handleConfirmDeleteSubject() {
    const { subjectId } = confirmDeleteSubject
    setConfirmDeleteSubject((prev) => ({ ...prev, open: false }))
    setSaving(true)

    setLocalSubjects((prev) => prev.filter((s) => s.id !== subjectId))

    try {
      await deleteSubject(subjectId)
      router.refresh()
      showToast("Matéria excluída com sucesso!")
    } catch (err) {
      console.error("Erro ao excluir matéria:", err)
      showToast(
        err instanceof Error ? err.message : "Erro ao deletar matéria",
        "error"
      )
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  async function handleConfirmDeleteTopic() {
    const { topicId } = confirmDeleteTopic
    setConfirmDeleteTopic((prev) => ({ ...prev, open: false }))
    setSaving(true)

    setLocalSubjects((prev) =>
      prev.map((s) => ({
        ...s,
        topics: s.topics.filter((t) => t.id !== topicId),
      }))
    )

    try {
      await deleteTopic(topicId)
      router.refresh()
      showToast("Assunto excluído com sucesso!")
    } catch (err) {
      console.error("Erro ao excluir assunto:", err)
      showToast(
        err instanceof Error ? err.message : "Erro ao deletar assunto",
        "error"
      )
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="relative">
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl px-4 py-3 shadow-lg ring-1 transition-all duration-300 ${
            toast.type === "success"
              ? "bg-emerald-950/90 ring-emerald-500/40 text-emerald-300"
              : "bg-red-950/90 ring-red-500/40 text-red-300"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCircle className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          <p className="text-sm font-medium leading-snug">{toast.message}</p>
          <button
            onClick={() => setToast(null)}
            className="ml-1 rounded p-0.5 opacity-70 hover:opacity-100"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <Dialog
        open={confirmDeleteSubject.open}
        onOpenChange={(open) =>
          setConfirmDeleteSubject((prev) => ({ ...prev, open }))
        }
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-foreground">
              Excluir matéria
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Tem certeza que deseja excluir a matéria{" "}
              <span className="font-medium text-foreground">
                &quot;{confirmDeleteSubject.subjectName}&quot;
              </span>
              ? Todos os assuntos e flashcards vinculados serão removidos
              permanentemente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              onClick={() =>
                setConfirmDeleteSubject((prev) => ({ ...prev, open: false }))
              }
              className="rounded-lg border border-border bg-secondary px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary/80"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirmDeleteSubject}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition-colors"
            >
              Excluir
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={confirmDeleteTopic.open}
        onOpenChange={(open) =>
          setConfirmDeleteTopic((prev) => ({ ...prev, open }))
        }
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-foreground">
              Excluir assunto
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Tem certeza que deseja excluir o assunto{" "}
              <span className="font-medium text-foreground">
                &quot;{confirmDeleteTopic.topicName}&quot;
              </span>
              ? Todos os flashcards vinculados serão removidos permanentemente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              onClick={() =>
                setConfirmDeleteTopic((prev) => ({ ...prev, open: false }))
              }
              className="rounded-lg border border-border bg-secondary px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary/80"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirmDeleteTopic}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition-colors"
            >
              Excluir
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="mb-6 flex items-center gap-3 rounded-xl border border-border bg-card p-3">
        <input
          value={newSubjectName}
          onChange={(e) => setNewSubjectName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreateSubject()}
          placeholder="Nome da nova matéria..."
          className="h-11 flex-1 rounded-lg border border-input bg-secondary/60 px-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <button
          onClick={handleCreateSubject}
          disabled={saving || !newSubjectName.trim()}
          className="flex h-11 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/85 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> {saving ? "Criando..." : "Criar Matéria"}
        </button>
      </div>

      {localSubjects.length === 0 ? (
        <EmptyState
          icon={Folder}
          title="Nenhuma matéria por aqui ainda"
          description="Crie a primeira matéria no campo acima e ela aparece aqui na hora."
        />
      ) : (
        <div className="space-y-4">
          {localSubjects.map((subject) => {
            const isExpanded = !!expandedIds[subject.id]
            const totalCards = subject.topics.reduce(
              (acc, t) => acc + t._count.flashcards,
              0
            )

            return (
              <div
                key={subject.id}
                className="rounded-xl border border-border bg-card overflow-hidden transition-all duration-300 hover:border-primary/40 shadow-sm"
              >
                <div
                  onClick={() => toggleExpand(subject.id)}
                  className="w-full flex items-center justify-between p-5 text-left bg-card hover:bg-secondary/20 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10">
                      <Folder className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold tracking-tight text-foreground">
                        {subject.name}
                      </h3>
                      <p className="mt-0.5 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                        {subject.topics.length}{" "}
                        {subject.topics.length === 1 ? "assunto" : "assuntos"} ·{" "}
                        {totalCards} {totalCards === 1 ? "card" : "cards"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/dashboard/flashcards/consultation?subjectId=${subject.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/20"
                    >
                      Estudar
                    </Link>
                    <div className="text-muted-foreground">
                      {isExpanded ? (
                        <ChevronUp className="h-5 w-5 text-primary" />
                      ) : (
                        <ChevronDown className="h-5 w-5" />
                      )}
                    </div>
                    <button
                      onClick={(e) =>
                        openConfirmDeleteSubject(subject.id, subject.name, e)
                      }
                      disabled={saving}
                      aria-label={`Excluir matéria ${subject.name}`}
                      className="rounded-lg p-1 text-muted-foreground hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-border/40 bg-secondary/10 px-5 py-4 animate-in slide-in-from-top-4 duration-200">
                    <div className="space-y-2">
                      {subject.topics.length === 0 ? (
                        <p className="rounded-lg border border-dashed border-border px-3 py-2.5 text-sm text-muted-foreground">
                          Nenhum assunto cadastrado para esta matéria.
                        </p>
                      ) : (
                        subject.topics.map((topic) => (
                          <div
                            key={topic.id}
                            className="flex flex-col sm:flex-row sm:items-center justify-between py-3.5 gap-4 divide-y sm:divide-y-0 divide-border/30"
                          >
                            <div className="flex items-start gap-3">
                              <BookOpen className="h-4 w-4 text-muted-foreground mt-0.5" />
                              <div>
                                <h4 className="text-sm font-semibold text-foreground">
                                  {topic.name}
                                </h4>
                                <span className="inline-block rounded-full bg-secondary border border-border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mt-1">
                                  {topic._count.flashcards}{" "}
                                  {topic._count.flashcards === 1 ? "card" : "cards"}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 self-start sm:self-center pt-2 sm:pt-0">
                              {topic._count.flashcards > 0 ? (
                                <Link
                                  href={`/flashcards?topicId=${topic.id}`}
                                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 border border-primary/25 hover:bg-primary px-4 py-2 text-xs font-bold text-primary hover:text-primary-foreground transition-all duration-300 hover:shadow-[0_0_10px_rgba(0,229,255,0.25)]"
                                >
                                  <PlayCircle className="h-4 w-4" />
                                  Resolver flashcards do assunto
                                </Link>
                              ) : (
                                <span className="rounded-lg border border-dashed border-border bg-secondary/30 px-3 py-2 text-xs text-muted-foreground select-none">
                                  Sem cards cadastrados
                                </span>
                              )}
                              <button
                                onClick={() =>
                                  openConfirmDeleteTopic(topic.id, topic.name)
                                }
                                disabled={saving}
                                aria-label={`Excluir assunto ${topic.name}`}
                                className="rounded p-0.5 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="mt-4 flex gap-2">
                      <input
                        value={newTopicNames[subject.id] || ""}
                        onChange={(e) =>
                          setNewTopicNames((prev) => ({
                            ...prev,
                            [subject.id]: e.target.value,
                          }))
                        }
                        onKeyDown={(e) =>
                          e.key === "Enter" && handleCreateTopic(subject.id)
                        }
                        placeholder="Novo assunto..."
                        className="h-9 flex-1 rounded-lg border border-input bg-secondary/60 px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      <button
                        onClick={() => handleCreateTopic(subject.id)}
                        disabled={saving || !(newTopicNames[subject.id] || "").trim()}
                        className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-primary/85 disabled:opacity-50"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

"use client"

import React, { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ChevronDown,
  ChevronUp,
  Folder,
  BookOpen,
  Eye,
  Plus,
  Trash2,
  CheckCircle,
  AlertCircle,
  X,
  List,
  Pencil,
  Save,
  Loader2,
  EyeOff,
  GripVertical,
} from "lucide-react"
import {
  createSubject,
  createTopic,
  deleteSubject,
  deleteTopic,
  updateSubjectOrder,
  updateTopicOrder,
} from "@/lib/subjects/actions"
import {
  getFlashcardsByTopic,
  updateFlashcard,
  deleteFlashcard,
  updateFlashcardOrder,
} from "@/lib/flashcards/actions"
import { EmptyState } from "@/components/empty-state"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

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

function SortableSubjectWrapper({
  subject,
  children,
}: {
  subject: SubjectWithTopics
  children: (p: {
    attributes: ReturnType<typeof useSortable>["attributes"]
    listeners: ReturnType<typeof useSortable>["listeners"]
    isDragging: boolean
  }) => React.ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: subject.id,
  })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 10 : undefined,
  }
  return (
    <div ref={setNodeRef} style={style}>
      {children({ attributes, listeners, isDragging })}
    </div>
  )
}

function SortableTopicWrapper({
  topic,
  children,
}: {
  topic: TopicWithCount
  children: (p: {
    attributes: ReturnType<typeof useSortable>["attributes"]
    listeners: ReturnType<typeof useSortable>["listeners"]
    isDragging: boolean
  }) => React.ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: topic.id,
  })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  }
  return (
    <div ref={setNodeRef} style={style}>
      {children({ attributes, listeners, isDragging })}
    </div>
  )
}

function SortableFlashcardWrapper({
  card,
  children,
}: {
  card: { id: string }
  children: (p: {
    attributes: ReturnType<typeof useSortable>["attributes"]
    listeners: ReturnType<typeof useSortable>["listeners"]
    isDragging: boolean
  }) => React.ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
  })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 10 : undefined,
  }
  return (
    <div ref={setNodeRef} style={style}>
      {children({ attributes, listeners, isDragging })}
    </div>
  )
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

  type TopicCard = {
    id: string
    front: string
    back: string
    cardType: string
    createdAt: Date | string
    topicId: string | null
    order: number
  }
  const [viewAllTopic, setViewAllTopic] = useState<{ id: string; name: string } | null>(null)
  const [topicCards, setTopicCards] = useState<TopicCard[]>([])
  const [loadingCards, setLoadingCards] = useState(false)
  const [editingCardId, setEditingCardId] = useState<string | null>(null)
  const [editFront, setEditFront] = useState("")
  const [editBack, setEditBack] = useState("")
  const [savingCard, setSavingCard] = useState(false)
  const [viewCardId, setViewCardId] = useState<string | null>(null)
  const [confirmDeleteCard, setConfirmDeleteCard] = useState<{ id: string; front: string } | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  )

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

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const activeId = String(active.id)
    const overId = String(over.id)

    // 1) Tentar reorder de matérias (subjects)
    const oldIndex = localSubjects.findIndex((s) => s.id === activeId)
    const newIndex = localSubjects.findIndex((s) => s.id === overId)
    if (oldIndex !== -1 && newIndex !== -1) {
      const reordered = arrayMove(localSubjects, oldIndex, newIndex)
      setLocalSubjects(reordered)
      const items = reordered.map((s, idx) => ({ id: s.id, order: idx }))
      try {
        await updateSubjectOrder(items)
      } catch (err) {
        console.error("Erro ao reordenar matérias:", err)
        showToast(err instanceof Error ? err.message : "Erro ao reordenar matérias", "error")
        setLocalSubjects(localSubjects)
      }
      return
    }

    // 2) Tentar reorder de assuntos dentro da mesma matéria
    const activeSubject = localSubjects.find((s) => s.topics.some((t) => t.id === activeId))
    const overSubject = localSubjects.find((s) => s.topics.some((t) => t.id === overId))
    if (activeSubject && overSubject && activeSubject.id === overSubject.id) {
      const oldTopicIndex = activeSubject.topics.findIndex((t) => t.id === activeId)
      const newTopicIndex = activeSubject.topics.findIndex((t) => t.id === overId)
      if (oldTopicIndex !== -1 && newTopicIndex !== -1) {
        const reorderedTopics = arrayMove(activeSubject.topics, oldTopicIndex, newTopicIndex)
        const newSubjects = localSubjects.map((s) =>
          s.id === activeSubject.id ? { ...s, topics: reorderedTopics } : s
        )
        setLocalSubjects(newSubjects)
        const items = reorderedTopics.map((t, idx) => ({ id: t.id, order: idx }))
        try {
          await updateTopicOrder(items)
        } catch (err) {
          console.error("Erro ao reordenar assuntos:", err)
          showToast(err instanceof Error ? err.message : "Erro ao reordenar assuntos", "error")
          setLocalSubjects(localSubjects)
        }
        return
      }
    }
    // se arrastou entre matérias diferentes, ignora (prompt diz: assuntos dentro de uma mesma matéria)
  }

  async function handleFlashcardDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const activeId = String(active.id)
    const overId = String(over.id)
    const oldIndex = topicCards.findIndex((c) => c.id === activeId)
    const newIndex = topicCards.findIndex((c) => c.id === overId)
    if (oldIndex === -1 || newIndex === -1) return
    const previous = [...topicCards]
    const reordered = arrayMove(topicCards, oldIndex, newIndex)
    setTopicCards(reordered)
    const items = reordered.map((c, idx) => ({ id: c.id, order: idx }))
    try {
      await updateFlashcardOrder(items)
    } catch (err) {
      console.error("Erro ao reordenar flashcards:", err)
      showToast(err instanceof Error ? err.message : "Erro ao reordenar flashcards", "error")
      setTopicCards(previous)
    }
  }

  async function handleOpenViewAll(topicId: string, topicName: string) {
    setViewAllTopic({ id: topicId, name: topicName })
    setLoadingCards(true)
    setTopicCards([])
    setEditingCardId(null)
    setViewCardId(null)
    try {
      const cards = await getFlashcardsByTopic(topicId)
      setTopicCards(cards as TopicCard[])
    } catch (err) {
      console.error("Erro ao carregar flashcards:", err)
      showToast(err instanceof Error ? err.message : "Erro ao carregar cards", "error")
    } finally {
      setLoadingCards(false)
    }
  }

  function startEditCard(card: TopicCard) {
    setEditingCardId(card.id)
    setEditFront(card.front)
    setEditBack(card.back)
    setViewCardId(null)
  }

  function cancelEditCard() {
    setEditingCardId(null)
    setEditFront("")
    setEditBack("")
  }

  async function handleSaveEditCard() {
    if (!editingCardId) return
    if (!editFront.trim() || !editBack.trim()) {
      showToast("Pergunta e resposta são obrigatórias", "error")
      return
    }
    setSavingCard(true)
    try {
      await updateFlashcard(editingCardId, editFront, editBack)
      setTopicCards((prev) =>
        prev.map((c) => (c.id === editingCardId ? { ...c, front: editFront.trim(), back: editBack.trim() } : c))
      )
      setEditingCardId(null)
      showToast("Flashcard atualizado com sucesso!")
      router.refresh()
    } catch (err) {
      console.error("Erro ao editar flashcard:", err)
      showToast(err instanceof Error ? err.message : "Erro ao editar", "error")
    } finally {
      setSavingCard(false)
    }
  }

  async function handleConfirmDeleteCard() {
    if (!confirmDeleteCard) return
    const cardId = confirmDeleteCard.id
    setConfirmDeleteCard(null)
    setSavingCard(true)
    try {
      await deleteFlashcard(cardId)
      setTopicCards((prev) => prev.filter((c) => c.id !== cardId))
      if (viewAllTopic) {
        setLocalSubjects((prev) =>
          prev.map((s) => ({
            ...s,
            topics: s.topics.map((t) =>
              t.id === viewAllTopic.id ? { ...t, _count: { flashcards: Math.max(0, t._count.flashcards - 1) } } : t
            ),
          }))
        )
      }
      showToast("Flashcard excluído com sucesso!")
      router.refresh()
    } catch (err) {
      console.error("Erro ao excluir flashcard:", err)
      showToast(err instanceof Error ? err.message : "Erro ao excluir", "error")
    } finally {
      setSavingCard(false)
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

      <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3 sm:flex-row sm:items-center sm:gap-3">
        <input
          value={newSubjectName}
          onChange={(e) => setNewSubjectName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreateSubject()}
          placeholder="Nome da nova matéria..."
          className="h-11 flex-1 rounded-lg border border-input bg-secondary/60 px-4 text-sm text-foreground placeholder:text-muted-foreground transition-all duration-200 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <button
          onClick={handleCreateSubject}
          disabled={saving || !newSubjectName.trim()}
          className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition-all duration-200 ease-out hover:bg-primary/90 hover:shadow-[0_0_12px_rgba(0,212,255,0.15)] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="h-4 w-4" aria-hidden="true" /> {saving ? "Criando..." : "Criar Matéria"}
        </button>
      </div>
      <div className="mb-2" />

      {localSubjects.length === 0 ? (
        <EmptyState
          icon={Folder}
          title="Nenhuma matéria por aqui ainda"
          description="Crie a primeira matéria no campo acima e ela aparece aqui na hora."
        />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={localSubjects.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-4">
              {localSubjects.map((subject) => {
                const isExpanded = !!expandedIds[subject.id]
                const totalCards = subject.topics.reduce(
                  (acc, t) => acc + t._count.flashcards,
                  0
                )

                return (
                  <SortableSubjectWrapper key={subject.id} subject={subject}>
                    {({ attributes, listeners, isDragging }) => (
                      <div
                        className={`rounded-xl border bg-card overflow-hidden shadow-sm transition-all duration-200 ease-out hover:border-primary/25 hover:shadow-md ${
                          isDragging ? "border-primary/40 shadow-lg" : "border-border"
                        }`}
                      >
                        <div className="flex w-full items-center justify-between gap-3 bg-card p-4 text-left transition-colors duration-200 hover:bg-secondary/20 sm:p-5">
                          <button
                            {...attributes}
                            {...listeners}
                            onClick={(e) => e.stopPropagation()}
                            aria-label={`Arrastar matéria ${subject.name}`}
                            className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground cursor-grab active:cursor-grabbing touch-none"
                          >
                            <GripVertical className="h-4 w-4" />
                          </button>
                          <div
                            onClick={() => toggleExpand(subject.id)}
                            className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 sm:gap-4"
                          >
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 sm:h-11 sm:w-11">
                              <Folder className="h-5 w-5 text-primary" aria-hidden="true" />
                            </div>
                            <div className="min-w-0">
                              <h3 className="truncate text-base font-bold tracking-tight text-foreground sm:text-lg">
                                {subject.name}
                              </h3>
                              <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground sm:text-[11px]">
                                {subject.topics.length}{" "}
                                {subject.topics.length === 1 ? "assunto" : "assuntos"} ·{" "}
                                {totalCards} {totalCards === 1 ? "card" : "cards"}
                              </p>
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                            <Link
                              href={`/dashboard/flashcards/consultation?subjectId=${subject.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition-all duration-200 hover:bg-primary/20 active:scale-[0.98]"
                            >
                              Estudar
                            </Link>
                            <div
                              onClick={() => toggleExpand(subject.id)}
                              className="hidden cursor-pointer text-muted-foreground sm:block"
                              aria-hidden="true"
                            >
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
                              className="rounded-lg p-1.5 text-muted-foreground transition-colors duration-200 hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="border-t border-border/40 bg-secondary/10 px-5 py-4 animate-in slide-in-from-top-4 duration-200">
                            <SortableContext
                              items={subject.topics.map((t) => t.id)}
                              strategy={verticalListSortingStrategy}
                            >
                              <div className="space-y-2">
                                {subject.topics.length === 0 ? (
                                  <p className="rounded-lg border border-dashed border-border px-3 py-2.5 text-sm text-muted-foreground">
                                    Nenhum assunto cadastrado para esta matéria.
                                  </p>
                                ) : (
                                  subject.topics.map((topic) => (
                                    <SortableTopicWrapper key={topic.id} topic={topic}>
                                      {({ attributes: tAttr, listeners: tList, isDragging: tDragging }) => (
                                        <div
                                          className={`flex flex-col sm:flex-row sm:items-center justify-between py-3.5 gap-4 divide-y sm:divide-y-0 divide-border/30 rounded-lg border bg-card/50 px-3 transition-colors ${
                                            tDragging
                                              ? "border-primary/30 bg-secondary/40 shadow-sm"
                                              : "border-transparent"
                                          }`}
                                        >
                                          <div className="flex items-start gap-2 flex-1 min-w-0">
                                            <button
                                              {...tAttr}
                                              {...tList}
                                              aria-label={`Arrastar assunto ${topic.name}`}
                                              className="mt-0.5 shrink-0 rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground cursor-grab active:cursor-grabbing touch-none"
                                            >
                                              <GripVertical className="h-3.5 w-3.5" />
                                            </button>
                                            <BookOpen className="h-4 w-4 text-muted-foreground mt-1 shrink-0" />
                                            <div className="min-w-0">
                                              <h4 className="text-sm font-semibold text-foreground truncate">
                                                {topic.name}
                                              </h4>
                                              <span className="inline-block rounded-full bg-secondary border border-border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mt-1">
                                                {topic._count.flashcards}{" "}
                                                {topic._count.flashcards === 1 ? "card" : "cards"}
                                              </span>
                                            </div>
                                          </div>

                                          <div className="flex items-center gap-2 self-start sm:self-center pt-2 sm:pt-0 shrink-0">
                                            <button
                                              onClick={() => handleOpenViewAll(topic.id, topic.name)}
                                              className="inline-flex items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/5 hover:bg-primary/10 px-4 py-2 text-xs font-semibold text-primary transition-colors"
                                              title="Visualizar todos os flashcards deste assunto"
                                            >
                                              <List className="h-4 w-4" />
                                              Visualizar todos
                                            </button>
                                            {topic._count.flashcards > 0 ? (
                                              <div className="flex flex-wrap gap-2">
                                                <Link
                                                  href={`/dashboard/flashcards/consultation?topicId=${topic.id}`}
                                                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary/60 hover:bg-secondary px-4 py-2 text-xs font-semibold text-foreground transition-colors"
                                                  title="Consulta visual — apenas revela o gabarito, sem IA e sem atualizar ProgressCard"
                                                >
                                                  <Eye className="h-4 w-4" />
                                                  Consultar (visual)
                                                </Link>
                                              </div>
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
                                      )}
                                    </SortableTopicWrapper>
                                  ))
                                )}
                              </div>
                            </SortableContext>

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
                    )}
                  </SortableSubjectWrapper>
                )
              })}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Dialog Visualizar todos - lista de flashcards por assunto */}
      <Dialog open={!!viewAllTopic} onOpenChange={(open) => !open && setViewAllTopic(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-foreground">
              Flashcards — {viewAllTopic?.name}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {loadingCards
                ? "Carregando..."
                : topicCards.length === 0
                ? "Nenhum flashcard cadastrado para este assunto."
                : `${topicCards.length} ${topicCards.length === 1 ? "flashcard" : "flashcards"} neste assunto`}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto -mx-4 px-4 py-2">
            {loadingCards ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : topicCards.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border bg-secondary/20 px-4 py-6 text-center text-sm text-muted-foreground">
                Nenhum card aqui ainda.
              </p>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleFlashcardDragEnd}>
                <SortableContext items={topicCards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-3">
                    {topicCards.map((card) => {
                      const isEditing = editingCardId === card.id
                      const isViewing = viewCardId === card.id
                      return (
                        <SortableFlashcardWrapper key={card.id} card={card}>
                          {({ attributes, listeners, isDragging }) => (
                            <div
                              className={`rounded-xl border bg-card p-4 shadow-sm transition-all ${isDragging ? "border-primary/40 shadow-md opacity-60" : "border-border"}`}
                            >
                              {isEditing ? (
                                <div className="space-y-3">
                                  <div className="space-y-1">
                                    <label className="text-xs font-semibold text-foreground">Pergunta (Frente)</label>
                                    <textarea
                                      value={editFront}
                                      onChange={(e) => setEditFront(e.target.value)}
                                      rows={2}
                                      className="w-full rounded-lg border border-input bg-secondary/60 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                                      placeholder="Pergunta"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-xs font-semibold text-foreground">Resposta (Verso)</label>
                                    <textarea
                                      value={editBack}
                                      onChange={(e) => setEditBack(e.target.value)}
                                      rows={2}
                                      className="w-full rounded-lg border border-input bg-secondary/60 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                                      placeholder="Resposta"
                                    />
                                  </div>
                                  <div className="flex justify-end gap-2">
                                    <button
                                      onClick={cancelEditCard}
                                      disabled={savingCard}
                                      className="rounded-lg border border-border bg-secondary px-4 py-2 text-xs font-semibold text-foreground hover:bg-secondary/80 disabled:opacity-50"
                                    >
                                      Cancelar
                                    </button>
                                    <button
                                      onClick={handleSaveEditCard}
                                      disabled={savingCard}
                                      className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                                    >
                                      {savingCard ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                                      Salvar
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex gap-2">
                                  <button
                                    {...attributes}
                                    {...listeners}
                                    aria-label={`Arrastar flashcard ${card.front.slice(0, 20)}`}
                                    className="mt-1 shrink-0 self-start rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground cursor-grab active:cursor-grabbing touch-none"
                                  >
                                    <GripVertical className="h-4 w-4" />
                                  </button>
                                  <div className="flex-1 min-w-0">
                                    <div className="space-y-2">
                                      <p className="text-sm font-medium text-foreground line-clamp-3">
                                        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground mr-1">P:</span>
                                        {card.front}
                                      </p>
                                      {isViewing && (
                                        <p className="text-sm text-muted-foreground border-t border-border/40 pt-2">
                                          <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-primary mr-1">R:</span>
                                          {card.back}
                                        </p>
                                      )}
                                    </div>
                                    <div className="mt-3 flex items-center gap-1.5 justify-end flex-wrap">
                                      <button
                                        onClick={() => setViewCardId(isViewing ? null : card.id)}
                                        className="inline-flex items-center gap-1 rounded-lg border border-border bg-secondary/60 hover:bg-secondary px-3 py-1.5 text-xs font-semibold text-foreground transition-colors"
                                        title={isViewing ? "Ocultar resposta" : "Visualizar pergunta e resposta"}
                                      >
                                        {isViewing ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                        {isViewing ? "Ocultar" : "Visualizar"}
                                      </button>
                                      <button
                                        onClick={() => startEditCard(card)}
                                        className="inline-flex items-center gap-1 rounded-lg border border-border bg-secondary/60 hover:bg-secondary px-3 py-1.5 text-xs font-semibold text-foreground transition-colors"
                                      >
                                        <Pencil className="h-3.5 w-3.5" />
                                        Editar
                                      </button>
                                      <button
                                        onClick={() => setConfirmDeleteCard({ id: card.id, front: card.front })}
                                        className="inline-flex items-center gap-1 rounded-lg bg-red-600 hover:bg-red-700 px-3 py-1.5 text-xs font-semibold text-white transition-colors"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                        Excluir
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </SortableFlashcardWrapper>
                      )
                    })}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>

          <DialogFooter>
            <button
              onClick={() => setViewAllTopic(null)}
              className="rounded-lg border border-border bg-secondary px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary/80"
            >
              Fechar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação excluir flashcard individual */}
      <Dialog open={!!confirmDeleteCard} onOpenChange={(open) => !open && setConfirmDeleteCard(null)}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-foreground">Excluir flashcard</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Tem certeza que deseja excluir o flashcard{" "}
              <span className="font-medium text-foreground">&quot;{confirmDeleteCard?.front.slice(0, 80)}&quot;</span>
              ? Esta ação remove apenas este card e não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              onClick={() => setConfirmDeleteCard(null)}
              className="rounded-lg border border-border bg-secondary px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary/80"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirmDeleteCard}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition-colors"
            >
              Excluir
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

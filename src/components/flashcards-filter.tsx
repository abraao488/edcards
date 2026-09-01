"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Filter, ChevronDown } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { SubjectWithTopicsAndCounts } from "@/lib/materias/actions"

const ALL = "__all__"

interface FlashcardsFilterProps {
  subjects: SubjectWithTopicsAndCounts[]
  initialTopicId?: string
}

export function FlashcardsFilter({
  subjects,
  initialTopicId,
}: FlashcardsFilterProps) {
  const router = useRouter()

  const initialSubjectId = initialTopicId
    ? subjects.find((s) => s.topics.some((t) => t.id === initialTopicId))?.id
    : undefined

  const [subjectId, setSubjectId] = useState<string | undefined>(initialSubjectId)
  const [topicId, setTopicId] = useState<string | undefined>(initialTopicId)

  const topics = subjects.find((s) => s.id === subjectId)?.topics ?? []

  const handleSubjectChange = (value: string | null) => {
    const v = value ?? ALL
    setSubjectId(v === ALL ? undefined : v)
    setTopicId(undefined)
    if (v === ALL || !v) {
      router.push("/flashcards")
    }
  }

  const handleTopicChange = (value: string | null) => {
    const v = value ?? ALL
    setTopicId(v === ALL ? undefined : v)
    if (v === ALL || !v) {
      router.push("/flashcards")
    } else {
      router.push(`/flashcards?topicId=${encodeURIComponent(v)}`)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="inline-flex items-center gap-1.5 font-medium text-muted-foreground">
        <Filter className="h-4 w-4 text-primary" />
        Matéria:
      </span>

      <Select value={subjectId ?? ALL} onValueChange={handleSubjectChange}>
        <SelectTrigger className="h-8 border-border bg-card">
          <SelectValue placeholder="Todas as matérias" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Todas as matérias</SelectItem>
          {subjects.map((subject) => (
            <SelectItem key={subject.id} value={subject.id}>
              {subject.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <span className="inline-flex items-center gap-1.5 font-medium text-muted-foreground">
        <ChevronDown className="h-4 w-4 text-muted-foreground/60" />
        Assunto:
      </span>

      <Select
        value={topicId ?? ALL}
        onValueChange={handleTopicChange}
        disabled={!subjectId}
      >
        <SelectTrigger className="h-8 border-border bg-card">
          <SelectValue placeholder="Todos os assuntos" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Todos os assuntos</SelectItem>
          {topics.map((topic) => (
            <SelectItem key={topic.id} value={topic.id}>
              {topic.name} ({topic._count.flashcards})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
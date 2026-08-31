"use client"

import { useState, useMemo } from "react"
import { Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { RevisionCalendarModal } from "./revision-calendar-modal"

interface CalendarEntry {
  front: string
  deckName: string
  subjectName?: string
  topicName?: string
}

interface RevisionCalendarInlineProps {
  calendar: Record<string, Array<CalendarEntry>>
}

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]

function formatCardLabel(entry: CalendarEntry): string {
  const subject = entry.subjectName || entry.deckName
  const detail = entry.topicName || entry.front
  if (subject && detail) return `${subject} — ${detail}`
  if (subject) return subject
  return entry.front || entry.deckName
}

export function RevisionCalendarInline({
  calendar,
}: RevisionCalendarInlineProps) {
  const [modalOpen, setModalOpen] = useState(false)
  const [hoveredDate, setHoveredDate] = useState<string | null>(null)

  const today = useMemo(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
  }, [])

  const next28Days = useMemo(() => {
    const days: Array<{
      date: string
      day: number
      weekday: string
      entries: CalendarEntry[]
      count: number
      isToday: boolean
    }> = []
    for (let i = 0; i < 28; i++) {
      const d = new Date()
      d.setDate(d.getDate() + i)
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
      days.push({
        date: dateStr,
        day: d.getDate(),
        weekday: WEEKDAYS[d.getDay()],
        entries: calendar[dateStr] || [],
        count: (calendar[dateStr] || []).length,
        isToday: dateStr === today,
      })
    }
    return days
  }, [calendar, today])

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="mb-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.25em] text-primary">
            Agenda
          </p>
          <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight text-foreground">
            <Calendar className="h-5 w-5 text-primary" />
            Calendário de Revisões
          </h2>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          Visualizar revisões
        </Button>
      </div>

      <div className="relative grid grid-cols-7 gap-2">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="py-1 text-center font-mono text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground"
          >
            {day}
          </div>
        ))}

        {next28Days.map((day) => (
          <div key={day.date} className="relative">
            <div
              className={cn(
                "flex h-12 flex-col items-center justify-center rounded-lg border transition-all",
                day.isToday &&
                  "border-primary bg-primary/10 font-mono font-bold text-primary shadow-[0_0_14px_rgba(0,212,255,0.12)]",
                !day.isToday &&
                  day.count > 0 &&
                  "border-border bg-secondary text-foreground hover:bg-secondary/80",
                !day.isToday &&
                  day.count === 0 &&
                  "border-transparent text-muted-foreground"
              )}
              onMouseEnter={() => setHoveredDate(day.date)}
              onMouseLeave={() => setHoveredDate(null)}
            >
              <span className={cn("text-xs", !day.isToday && "font-mono")}>{day.day}</span>
              {day.count > 0 && (
                <span
                  className={cn(
                    "font-mono text-[11px] font-bold",
                    day.isToday ? "text-primary" : "text-cyan-400"
                  )}
                >
                  {day.count}
                </span>
              )}
            </div>

            {hoveredDate === day.date && day.entries.length > 0 && (
              <div className="absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 rounded-lg border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-lg">
                {day.entries.slice(0, 3).map((entry, i) => (
                  <div key={i} className="max-w-[220px] truncate font-mono">
                    {formatCardLabel(entry)}
                  </div>
                ))}
                {day.entries.length > 3 && (
                  <div className="mt-0.5 font-mono text-muted-foreground">
                    +{day.entries.length - 3} outros
                  </div>
                )}
                <div className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-b border-r border-border bg-popover" />
              </div>
            )}
          </div>
        ))}
      </div>

      <RevisionCalendarModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        calendar={calendar}
      />
    </div>
  )
}
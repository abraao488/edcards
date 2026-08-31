"use client"

import { useState, useMemo } from "react"
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface CalendarEntry {
  front: string
  deckName: string
  subjectName?: string
  topicName?: string
}

interface RevisionCalendarModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  calendar: Record<string, Array<CalendarEntry>>
}

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]
const MONTH_NAMES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
]

function formatCardLabel(entry: CalendarEntry): string {
  const subject = entry.subjectName || entry.deckName
  const detail = entry.topicName || entry.front
  if (subject && detail) return `${subject} — ${detail}`
  if (subject) return subject
  return entry.front || entry.deckName
}

export function RevisionCalendarModal({
  open,
  onOpenChange,
  calendar,
}: RevisionCalendarModalProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const today = useMemo(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
  }, [])

  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const startPad = firstDay.getDay()

    const days: Array<{
      date: string
      day: number
      entries: CalendarEntry[]
      count: number
      isToday: boolean
      isPast: boolean
    }> = []

    for (let i = 0; i < startPad; i++) {
      const d = new Date(year, month, -startPad + i + 1)
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
      days.push({
        date: dateStr,
        day: d.getDate(),
        entries: calendar[dateStr] || [],
        count: (calendar[dateStr] || []).length,
        isToday: dateStr === today,
        isPast: true,
      })
    }

    for (let i = 1; i <= lastDay.getDate(); i++) {
      const d = new Date(year, month, i)
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
      days.push({
        date: dateStr,
        day: i,
        entries: calendar[dateStr] || [],
        count: (calendar[dateStr] || []).length,
        isToday: dateStr === today,
        isPast: new Date(dateStr) < new Date(today),
      })
    }

    const remaining = 42 - days.length
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i)
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
      days.push({
        date: dateStr,
        day: i,
        entries: calendar[dateStr] || [],
        count: (calendar[dateStr] || []).length,
        isToday: dateStr === today,
        isPast: false,
      })
    }

    return days
  }, [currentMonth, calendar, today])

  const prevMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1)
    )
    setSelectedDate(null)
  }

  const nextMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1)
    )
    setSelectedDate(null)
  }

  const selectedEntries = selectedDate ? calendar[selectedDate] || [] : []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Calendário de Revisões
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon-sm" onClick={prevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium text-foreground">
            {MONTH_NAMES[currentMonth.getMonth()]}{" "}
            {currentMonth.getFullYear()}
          </span>
          <Button variant="ghost" size="icon-sm" onClick={nextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {WEEKDAYS.map((day) => (
            <div
              key={day}
              className="py-1 text-center text-xs font-medium text-muted-foreground"
            >
              {day}
            </div>
          ))}

          {calendarDays.map((day, i) => (
            <button
              key={i}
              onClick={() =>
                setSelectedDate(
                  selectedDate === day.date ? null : day.date
                )
              }
              className={cn(
                "relative flex h-10 flex-col items-center justify-center rounded-lg text-sm transition-all",
                day.isPast && !day.isToday && "opacity-40",
                day.isToday &&
                  "bg-primary/20 font-bold text-primary ring-1 ring-primary/50",
                selectedDate === day.date &&
                  "bg-primary/10 ring-1 ring-primary/30",
                !day.isToday &&
                  !day.isPast &&
                  day.count > 0 &&
                  "bg-secondary hover:bg-secondary/80",
                !day.isToday &&
                  !day.isPast &&
                  day.count === 0 &&
                  "hover:bg-secondary/50"
              )}
            >
              <span>{day.day}</span>
              {day.count > 0 && (
                <span
                  className={cn(
                    "text-[10px] font-bold",
                    day.isToday ? "text-primary" : "text-cyan-400"
                  )}
                >
                  {day.count}
                </span>
              )}
              {selectedDate === day.date && (
                <div className="absolute -bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-primary" />
              )}
            </button>
          ))}
        </div>

        {selectedDate && (
          <div className="rounded-lg border border-border bg-secondary/50 p-3">
            <p className="mb-2 text-sm text-muted-foreground">
              {new Date(selectedDate + "T12:00:00").toLocaleDateString("pt-BR", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </p>
            {selectedEntries.length === 0 ? (
              <p className="text-center text-sm font-medium text-foreground">
                Nenhum card agendado
              </p>
            ) : (
              <ul className="space-y-1">
                {selectedEntries.slice(0, 5).map((entry, i) => (
                  <li
                    key={i}
                    className="truncate font-mono text-xs text-foreground"
                  >
                    <span className="text-cyan-400">›</span>{" "}
                    {formatCardLabel(entry)}
                  </li>
                ))}
                {selectedEntries.length > 5 && (
                  <li className="font-mono text-xs text-muted-foreground">
                    +{selectedEntries.length - 5} outros cards
                  </li>
                )}
              </ul>
            )}
          </div>
        )}

        <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="h-2 w-2 rounded-full bg-primary" />
            Hoje
          </div>
          <div className="flex items-center gap-1">
            <div className="h-2 w-2 rounded-full bg-cyan-400" />
            Com revisões
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
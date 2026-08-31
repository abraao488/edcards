import { type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  action?: React.ReactNode
  className?: string
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-dashed border-border bg-card/60 px-6 py-14 text-center",
        className
      )}
    >
      <div className="pointer-events-none absolute -top-16 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full bg-primary/[0.07] blur-3xl" />

      {/* Pilha de flashcards */}
      <div className="relative mx-auto mb-7 h-24 w-36">
        <div className="absolute inset-x-5 bottom-0 h-[4.5rem] -rotate-6 rounded-xl border border-primary/15 bg-secondary/70" />
        <div className="absolute inset-x-4 bottom-1 h-[4.5rem] rotate-[4deg] rounded-xl border border-border bg-card shadow-sm" />
        <div className="absolute inset-x-0 bottom-2 flex h-[4.5rem] items-center justify-center rounded-xl border border-primary/30 bg-gradient-to-b from-secondary to-card shadow-[0_10px_35px_-10px_rgba(0,212,255,0.25)]">
          <Icon className="h-8 w-8 text-primary" />
        </div>
      </div>

      <h3 className="text-lg font-bold tracking-tight text-foreground">
        {title}
      </h3>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  )
}

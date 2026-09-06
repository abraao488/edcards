import { type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface MetricCardProps {
  label: string
  value: number | string
  icon: LucideIcon
  color: "cyan" | "red" | "orange" | "purple"
  suffix?: string
}

const colorMap = {
  cyan: {
    icon: "text-cyan-400",
    bg: "bg-cyan-500/10",
    border: "border-cyan-500/20",
    bar: "bg-cyan-500/40",
  },
  red: {
    icon: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/20",
    bar: "bg-red-500/40",
  },
  orange: {
    icon: "text-orange-400",
    bg: "bg-orange-500/10",
    border: "border-orange-500/20",
    bar: "bg-orange-500/40",
  },
  purple: {
    icon: "text-purple-400",
    bg: "bg-purple-500/10",
    border: "border-purple-500/20",
    bar: "bg-purple-500/40",
  },
}

export function MetricCard({
  label,
  value,
  icon: Icon,
  color,
  suffix,
}: MetricCardProps) {
  const colors = colorMap[color]

  return (
    <div className="group relative overflow-hidden rounded-xl border border-border bg-card p-4 sm:p-5 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-foreground/15 hover:shadow-[0_8px_24px_rgba(0,0,0,0.22)] animate-edcards-in">
      <div className="flex items-start justify-between gap-3">
        <span className="font-mono text-[10px] sm:text-[11px] font-semibold uppercase leading-relaxed tracking-[0.18em] text-muted-foreground">
          {label}
        </span>
        <div className={cn("shrink-0 rounded-lg border p-2 transition-colors duration-200 group-hover:scale-[1.04]", colors.bg, colors.border)}>
          <Icon className={cn("h-5 w-5", colors.icon)} aria-hidden="true" />
        </div>
      </div>
      <div className="mt-4 sm:mt-5 flex items-baseline gap-2">
        <p className="font-mono text-3xl sm:text-4xl font-semibold leading-none tracking-tight text-foreground">
          {value}
        </p>
        {suffix && (
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
      <div
        className={cn(
          "absolute bottom-0 left-0 h-0.5 w-0 transition-all duration-300 ease-out group-hover:w-full",
          colors.bar
        )}
      />
    </div>
  )
}

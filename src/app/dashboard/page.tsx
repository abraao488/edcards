import { getDashboardMetrics, getRevisionCalendar } from "@/lib/dashboard/actions"
import { Brain, AlertTriangle, Flame, BookOpen } from "lucide-react"
import { DashboardHeader } from "@/components/dashboard-header"
import { MetricCard } from "@/components/metric-card"
import { RevisionCalendarInline } from "@/components/revision-calendar-inline"

export default async function DashboardPage() {
  const metrics = await getDashboardMetrics()
  const calendar = await getRevisionCalendar(30)

  const today = new Date().toISOString().split("T")[0]
  const todayCount = (calendar[today] || []).length

  return (
    <div>
      <DashboardHeader
        name={metrics.name}
        avatarUrl={metrics.avatarUrl}
        concurrence={metrics.concurrence}
        email={metrics.email}
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Seus Flash Cards do dia"
          value={metrics.cardsToday + todayCount}
          icon={Brain}
          color="cyan"
          suffix="cards"
        />

        <MetricCard
          label="Seus Flash Cards atrasados"
          value={metrics.overdueCards}
          icon={AlertTriangle}
          color="red"
          suffix="cards"
        />

        <MetricCard
          label="Sua sequência de dias"
          value={metrics.streak}
          icon={Flame}
          color="orange"
          suffix="dias"
        />

        <MetricCard
          label="Sua quantidade de matérias"
          value={metrics.subjectsCount}
          icon={BookOpen}
          color="purple"
          suffix="matérias"
        />
      </div>

      <RevisionCalendarInline calendar={calendar} />
    </div>
  )
}
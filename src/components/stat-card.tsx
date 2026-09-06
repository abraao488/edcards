export function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 sm:p-4 text-center shadow-sm transition-all duration-200 ease-out hover:border-foreground/10 hover:shadow-md">
      <p className="font-mono text-xl font-bold leading-none tracking-tight text-foreground sm:text-2xl">{value}</p>
      <p className="mt-1 font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground sm:text-xs">{label}</p>
    </div>
  )
}

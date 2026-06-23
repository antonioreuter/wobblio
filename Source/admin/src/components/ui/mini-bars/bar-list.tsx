interface BarRow {
  label: string
  value: number
}

// Horizontal bar list for category breakdowns (e.g. by country / region).
export function BarList({ rows, testid }: { rows: BarRow[]; testid?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <div className="flex flex-col gap-1.5" data-testid={testid}>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2">
          <span className="w-32 shrink-0 truncate text-xs text-muted" title={r.label}>
            {r.label}
          </span>
          <div className="h-4 flex-1 overflow-hidden rounded bg-elevated">
            <div className="h-full rounded bg-brand" style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
          <span className="w-12 shrink-0 text-right text-xs font-medium tabular-nums text-fg">
            {r.value.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  )
}

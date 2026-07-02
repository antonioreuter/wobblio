// Shared "label + big number" tile used by both Queue Health and Agentic Pipeline sections.
export function StatTile({ label, value, tone = 'text-fg' }: { label: string; value?: number; tone?: string }) {
  return (
    <div className="rounded-[12px] border border-line bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${tone}`}>
        {value === undefined ? '—' : value.toLocaleString()}
      </p>
    </div>
  )
}

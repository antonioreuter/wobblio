// Monday (UTC) of the week containing the given ISO date — the single source of
// week boundaries shared by quotas, budgets, and the weekly advisor. Matches the
// SQL date_trunc('week', …) convention (ISO-8601, Monday-based).
export function weekStart(dateISO: string): string {
  const d = new Date(`${dateISO}T00:00:00Z`);
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + (day === 0 ? -6 : 1 - day));
  return d.toISOString().slice(0, 10);
}

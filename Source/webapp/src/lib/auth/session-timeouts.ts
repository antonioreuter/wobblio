// Idle-session policy. Defaults: sign out after 30 min of inactivity, with a
// 2-min "Still there?" warning. Overridable via env so E2E tests can use short
// windows without waiting 30 minutes.
function readMs(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export const IDLE_TIMEOUT_MS = readMs(
  process.env.NEXT_PUBLIC_IDLE_TIMEOUT_MS,
  30 * 60 * 1000,
)

export const IDLE_WARNING_MS = readMs(
  process.env.NEXT_PUBLIC_IDLE_WARNING_MS,
  2 * 60 * 1000,
)

'use client'

import { useCallback, useEffect, useState } from 'react'

const STORAGE_PREFIX = 'wobblio:split:'

export interface AssignableLine {
  id: string
  rawText: string
  quantity: number
  lineTotal: number
  isDiscount: boolean
  isDepositOrFee: boolean
}

// One participant's slice of a line, measured in that line's units (fractional units
// express a shared single item: 0.5 = ½). A line may carry several allocations.
export interface SplitAllocation {
  lineId: string
  participantName: string
  units: number
}

export interface LineAllocationInput {
  participantName: string
  units: number
}

export interface SplitItem {
  lineId: string
  label: string
  qty: number
  fraction: number
  amount: number
}

export interface SplitParticipant {
  name: string
  subtotal: number
  fees: number
  total: number
  items: SplitItem[]
}

export interface SplitSummary {
  participants: SplitParticipant[]
  grandTotal: number
}

interface ReadyState {
  status: 'ready'
  splitId: string
  currency: string | null
  lines: AssignableLine[]
  allocations: SplitAllocation[]
  summary: SplitSummary
}

export type BillSplitState = { status: 'loading' } | { status: 'error' } | ReadyState

async function jsonOrThrow(res: Response): Promise<unknown> {
  if (!res.ok) throw new Error(String(res.status))
  return res.json()
}

// There is no "list splits for invoice" endpoint (§11b) — POST always mints a new
// split row. Cache the id locally so reopening the drawer resumes the same split
// instead of orphaning a fresh one every time.
async function resolveSplitId(invoiceId: string): Promise<string> {
  const key = STORAGE_PREFIX + invoiceId
  const cached = localStorage.getItem(key)
  if (cached) {
    const check = await fetch(`/api/invoices/${invoiceId}/splits/${cached}`, { cache: 'no-store' })
    if (check.ok) return cached
  }
  const created = (await jsonOrThrow(
    await fetch(`/api/invoices/${invoiceId}/splits`, { method: 'POST' }),
  )) as { splitId: string }
  localStorage.setItem(key, created.splitId)
  return created.splitId
}

// The fee-pool-proportional-share + rounding-residual math (computeSplitSummary)
// lives only on the backend — every mutation refetches summary + allocations
// rather than re-deriving totals client-side.
async function fetchSplitState(invoiceId: string, splitId: string): Promise<Omit<ReadyState, 'status' | 'splitId' | 'currency' | 'lines'>> {
  const [detailRes, summaryRes] = await Promise.all([
    fetch(`/api/invoices/${invoiceId}/splits/${splitId}`, { cache: 'no-store' }),
    fetch(`/api/invoices/${invoiceId}/splits/${splitId}/summary`, { cache: 'no-store' }),
  ])
  const detail = (await jsonOrThrow(detailRes)) as { allocations: SplitAllocation[] }
  const summary = (await jsonOrThrow(summaryRes)) as SplitSummary
  return { allocations: detail.allocations, summary }
}

export function useBillSplit(invoiceId: string) {
  const [state, setState] = useState<BillSplitState>({ status: 'loading' })

  const load = useCallback(async () => {
    setState({ status: 'loading' })
    try {
      const splitId = await resolveSplitId(invoiceId)
      // Both requests must be in flight before either is awaited — an `await` inside
      // the first array element would block the second from even starting.
      const [invoice, rest] = await Promise.all([
        fetch(`/api/invoices/${invoiceId}`, { cache: 'no-store' }).then(jsonOrThrow) as Promise<{
          currency: string | null
          lines: AssignableLine[]
        }>,
        fetchSplitState(invoiceId, splitId),
      ])
      setState({ status: 'ready', splitId, currency: invoice.currency, lines: invoice.lines, ...rest })
    } catch {
      setState({ status: 'error' })
    }
  }, [invoiceId])

  useEffect(() => { void load() }, [load])

  const refresh = useCallback(async (splitId: string) => {
    const rest = await fetchSplitState(invoiceId, splitId)
    setState((prev) => (prev.status === 'ready' ? { ...prev, ...rest } : prev))
  }, [invoiceId])

  // Replace a line's whole allocation set. Every split gesture (assign a unit, change a
  // count, share ½/⅓, unassign) reduces to "here is the new set for this line".
  const setLineAllocations = useCallback(async (lineId: string, allocations: LineAllocationInput[]) => {
    if (state.status !== 'ready') return
    const res = await fetch(`/api/invoices/${invoiceId}/splits/${state.splitId}/lines/${lineId}/allocations`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ allocations }),
    })
    if (!res.ok) throw new Error(String(res.status))
    await refresh(state.splitId)
  }, [state, invoiceId, refresh])

  // A participant is only the implicit set of names across allocations, so removal means
  // stripping them from every line they hold — recompute each affected line without them.
  const removeParticipant = useCallback(async (name: string) => {
    if (state.status !== 'ready') return
    const lineIds = Array.from(
      new Set(state.allocations.filter((a) => a.participantName === name).map((a) => a.lineId)),
    )
    const results = await Promise.all(
      lineIds.map((lineId) => {
        const kept = state.allocations
          .filter((a) => a.lineId === lineId && a.participantName !== name)
          .map((a) => ({ participantName: a.participantName, units: a.units }))
        return fetch(`/api/invoices/${invoiceId}/splits/${state.splitId}/lines/${lineId}/allocations`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ allocations: kept }),
        })
      }),
    )
    await refresh(state.splitId)
    if (results.some((res) => !res.ok)) throw new Error('Failed to remove one or more allocations')
  }, [state, invoiceId, refresh])

  // Mints a public read-only /s/<token> link for this split (7-day expiry). Same
  // pattern as invoice sharing — the backend returns the full unguessable URL.
  const createShareLink = useCallback(async (): Promise<string | null> => {
    if (state.status !== 'ready') return null
    const res = await fetch(`/api/invoices/${invoiceId}/splits/${state.splitId}/share`, { method: 'POST' })
    if (!res.ok) return null
    const data = (await res.json()) as { shareUrl: string }
    return data.shareUrl
  }, [state, invoiceId])

  return { state, setLineAllocations, removeParticipant, createShareLink }
}

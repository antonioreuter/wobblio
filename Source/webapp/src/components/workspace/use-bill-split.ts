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

export interface SplitAssignment {
  lineId: string
  participantName: string
  fraction: number
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
  assignments: SplitAssignment[]
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
// lives only on the backend — every mutation refetches summary + assignments
// rather than re-deriving totals client-side.
async function fetchSplitState(invoiceId: string, splitId: string): Promise<Omit<ReadyState, 'status' | 'splitId' | 'currency' | 'lines'>> {
  const [detailRes, summaryRes] = await Promise.all([
    fetch(`/api/invoices/${invoiceId}/splits/${splitId}`, { cache: 'no-store' }),
    fetch(`/api/invoices/${invoiceId}/splits/${splitId}/summary`, { cache: 'no-store' }),
  ])
  const detail = (await jsonOrThrow(detailRes)) as { assignments: SplitAssignment[] }
  const summary = (await jsonOrThrow(summaryRes)) as SplitSummary
  return { assignments: detail.assignments, summary }
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

  const assignLine = useCallback(async (lineId: string, participantName: string, fraction: number) => {
    if (state.status !== 'ready') return
    const res = await fetch(`/api/invoices/${invoiceId}/splits/${state.splitId}/lines/${lineId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participantName, fraction }),
    })
    if (!res.ok) throw new Error(String(res.status))
    await refresh(state.splitId)
  }, [state, invoiceId, refresh])

  const unassignLine = useCallback(async (lineId: string) => {
    if (state.status !== 'ready') return
    const res = await fetch(`/api/invoices/${invoiceId}/splits/${state.splitId}/lines/${lineId}/assignment`, { method: 'DELETE' })
    if (!res.ok) throw new Error(String(res.status))
    await refresh(state.splitId)
  }, [state, invoiceId, refresh])

  // No "remove participant" endpoint exists — a participant is only the implicit
  // set of distinct names across assignments, so removal means unassigning every
  // line currently held by them.
  const removeParticipant = useCallback(async (name: string) => {
    if (state.status !== 'ready') return
    const lineIds = state.assignments.filter((a) => a.participantName === name).map((a) => a.lineId)
    const results = await Promise.all(
      lineIds.map((lineId) =>
        fetch(`/api/invoices/${invoiceId}/splits/${state.splitId}/lines/${lineId}/assignment`, { method: 'DELETE' }),
      ),
    )
    await refresh(state.splitId)
    if (results.some((res) => !res.ok)) throw new Error('Failed to remove one or more assignments')
  }, [state, invoiceId, refresh])

  const fetchWhatsappText = useCallback(async (): Promise<string | null> => {
    if (state.status !== 'ready') return null
    const res = await fetch(`/api/invoices/${invoiceId}/splits/${state.splitId}/whatsapp`, { cache: 'no-store' })
    if (!res.ok) return null
    const data = (await res.json()) as { text: string }
    return data.text
  }, [state, invoiceId])

  return { state, assignLine, unassignLine, removeParticipant, fetchWhatsappText }
}

'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSession } from 'next-auth/react'
import { Copy, Crown, Link2, Minus, MessageCircle, Plus, RotateCcw, Users, X } from 'lucide-react'
import { Avatar, Card } from '@/components/ds'
import { useWorkspace } from './workspace-provider'
import { fmtDate, fmtMoney, type Invoice } from './invoice-data'
import { useBillSplit, type AssignableLine, type LineAllocationInput } from './use-bill-split'
import { deriveInitials } from '@/lib/user-initials'
import { memberInitials } from './household-data'
import { seriesColor } from './trend-data'

const YOU = 'You'
const YOU_COLOR = seriesColor(0)
const MAX_PARTICIPANT_NAME_LENGTH = 40

// bill_split_line.units is NUMERIC(9,4) — 1/3 round-trips as 0.3333, so tolerances
// must clear that DB-rounding gap while staying tight enough to tell 1, ½, ⅓ apart.
const EPSILON = 1e-3

// Unicode vulgar fractions for the even-split shares a line can carry (1/N). Beyond ⅒
// the badge falls back to a plain "1/N" string.
const VULGAR_FRACTION: Record<number, string> = {
  2: '½', 3: '⅓', 4: '¼', 5: '⅕', 6: '⅙', 7: '⅐', 8: '⅛', 9: '⅑', 10: '⅒',
}

const canSplitBill = (role: string | undefined): boolean => !!role && role !== 'STANDARD'

function participantColor(name: string, namedParticipants: string[]): string {
  if (name === YOU) return YOU_COLOR
  const idx = namedParticipants.indexOf(name)
  return seriesColor(idx + 1)
}

// A unit-fraction (1/N) reads as its glyph; anything else (a whole share, a 2-of-3 slice)
// returns '' so callers fall back to their ×qty label.
function fractionLabel(fraction: number): string {
  if (fraction <= EPSILON || fraction >= 1 - EPSILON) return ''
  const n = Math.round(1 / fraction)
  if (n >= 2 && Math.abs(fraction - 1 / n) < EPSILON) return VULGAR_FRACTION[n] ?? `1/${n}`
  return ''
}

// How a participant's share of a line reads on their avatar badge: a unit count for
// multi-unit lines (×2), a fraction glyph for a shared single item (½), else nothing.
function shareLabel(units: number, lineQuantity: number): string {
  if (lineQuantity > 1 + EPSILON) return `×${Number(units.toFixed(2))}`
  return fractionLabel(units)
}

interface BillSplitDialogProps {
  invoice: Invoice
  role: string | undefined
  onClose: () => void
}

export function BillSplitDialog({ invoice, role, onClose }: BillSplitDialogProps) {
  const { showToast } = useWorkspace()
  const { data: session } = useSession()
  const { state, setLineAllocations, removeParticipant, fetchWhatsappText, createShareLink } = useBillSplit(invoice.id)
  const [participants, setParticipants] = useState<string[]>([])
  const [activeParticipant, setActiveParticipant] = useState<string>(YOU)
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [sharing, setSharing] = useState(false)

  const youInitials = deriveInitials(session?.user?.name ?? '', session?.user?.email ?? '')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    if (state.status !== 'ready') return
    const assignedNames = Array.from(new Set(state.allocations.map((a) => a.participantName)))
    setParticipants((prev) => Array.from(new Set([...prev, ...assignedNames])))
  }, [state])

  const namedParticipants =
    state.status === 'ready'
      ? Array.from(new Set([...participants, ...state.allocations.map((a) => a.participantName)]))
      : participants

  const addParticipant = () => {
    const trimmed = newName.trim().slice(0, MAX_PARTICIPANT_NAME_LENGTH)
    if (!trimmed || trimmed.toLowerCase() === YOU.toLowerCase()) return
    setParticipants((prev) =>
      prev.some((p) => p.toLowerCase() === trimmed.toLowerCase()) ? prev : [...prev, trimmed],
    )
    setActiveParticipant(trimmed)
    setNewName('')
  }

  const removeParticipantChip = async (name: string) => {
    const wasActive = activeParticipant === name
    setParticipants((prev) => prev.filter((p) => p !== name))
    setActiveParticipant((curr) => (curr === name ? YOU : curr))
    try {
      await removeParticipant(name)
    } catch {
      setParticipants((prev) => (prev.includes(name) ? prev : [...prev, name]))
      if (wasActive) setActiveParticipant(name)
      showToast(`Couldn't remove ${name} — please try again.`, 'danger')
    }
  }

  // Everything a participant holds on a line, and the running totals the gestures need.
  const allocationsFor = (lineId: string) =>
    state.status === 'ready' ? state.allocations.filter((a) => a.lineId === lineId) : []
  const unitsFor = (lineId: string, name: string) =>
    allocationsFor(lineId).find((a) => a.participantName === name)?.units ?? 0
  const othersOf = (lineId: string, name: string): LineAllocationInput[] =>
    allocationsFor(lineId)
      .filter((a) => a.participantName !== name)
      .map((a) => ({ participantName: a.participantName, units: a.units }))

  const commit = async (lineId: string, allocations: LineAllocationInput[]) => {
    try {
      await setLineAllocations(lineId, allocations)
    } catch {
      showToast("Couldn't update that line — please try again.", 'danger')
    }
  }

  // Multi-unit lines: nudge the active participant's unit count, capped by what's left.
  const stepUnits = async (line: AssignableLine, delta: number) => {
    if (activeParticipant === YOU) return
    setSelectedLineId(line.id)
    const others = othersOf(line.id, activeParticipant)
    const otherUnits = others.reduce((sum, a) => sum + a.units, 0)
    const next = Math.max(0, Math.min(unitsFor(line.id, activeParticipant) + delta, line.quantity - otherUnits))
    await commit(line.id, [...others, ...(next > EPSILON ? [{ participantName: activeParticipant, units: next }] : [])])
  }

  // A single-unit line's sharers: the named people who hold a slice, plus You when the line
  // is only partly assigned (You always absorbs the remainder). A fully-unassigned line has
  // no explicit sharers — it belongs to You by default.
  const sharersOf = (line: AssignableLine): string[] => {
    const named = allocationsFor(line.id).filter((a) => a.units > EPSILON).map((a) => a.participantName)
    const remainder = line.quantity - allocationsFor(line.id).reduce((sum, a) => sum + a.units, 0)
    return named.length > 0 && remainder > EPSILON ? [...named, YOU] : named
  }

  // Split a single-unit line evenly across a set of sharers (1/N each). Only named shares are
  // persisted; You's slice is the reconciled remainder. No named sharers → the line is all You.
  const applyEvenSplit = async (line: AssignableLine, sharers: string[]) => {
    const named = sharers.filter((name) => name !== YOU)
    if (named.length === 0) {
      await commit(line.id, [])
      return
    }
    const share = 1 / sharers.length
    await commit(line.id, named.map((name) => ({ participantName: name, units: share })))
  }

  // Single-unit lines: tapping toggles the active participant (named or You) in the line's
  // sharer set, then re-splits evenly — so one item can be shared across two or more people.
  const toggleShare = async (line: AssignableLine) => {
    setSelectedLineId(line.id)
    const sharers = sharersOf(line)
    const next = sharers.includes(activeParticipant)
      ? sharers.filter((name) => name !== activeParticipant)
      : [...sharers, activeParticipant]
    await applyEvenSplit(line, next)
  }

  const resetLine = async (line: AssignableLine) => {
    setSelectedLineId(line.id)
    if (allocationsFor(line.id).length > 0) await commit(line.id, [])
  }

  const shareLink = async () => {
    setSharing(true)
    try {
      const url = await createShareLink()
      if (!url) {
        showToast("Couldn't create a share link — please try again.", 'danger')
        return
      }
      setShareUrl(url)
      try {
        await navigator.clipboard.writeText(url)
        showToast('Share link copied — anyone with it can view the split.', 'success')
      } catch {
        // Clipboard can be blocked; the link is still shown for manual copy.
      }
    } finally {
      setSharing(false)
    }
  }

  const copyWhatsapp = async () => {
    const text = await fetchWhatsappText()
    if (!text) {
      showToast("Couldn't build the WhatsApp export — please try again.", 'danger')
      return
    }
    try {
      await navigator.clipboard.writeText(text)
      showToast('Split copied — paste it straight into WhatsApp.', 'success')
    } catch {
      showToast("Couldn't copy to clipboard — please try again.", 'danger')
    }
  }

  if (typeof document === 'undefined') return null

  const isPremium = canSplitBill(role)
  const currency = state.status === 'ready' ? state.currency : null
  const money = (amount: number) => fmtMoney(amount, currency)

  const assignedToOthers =
    state.status === 'ready'
      ? state.summary.participants.filter((p) => p.name !== YOU).reduce((sum, p) => sum + p.total, 0)
      : 0
  const grandTotal = state.status === 'ready' ? state.summary.grandTotal : 0

  // A summary item carries only its own units, not the line's quantity, so its label needs
  // the parent line to tell a shared single item (½) from one unit of a multi-unit line (×1).
  const lineQuantityById = (lineId: string): number =>
    (state.status === 'ready' ? state.lines.find((l) => l.id === lineId)?.quantity : undefined) ?? 1

  return createPortal(
    <div className="modal-overlay" onClick={onClose} data-testid="split-dialog">
      <div
        className="confirm-card split-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <button type="button" className="dialog-close" aria-label="Close" onClick={onClose}>
          ✕
        </button>
        <div className="confirm-top">
          <div className="share-icon"><Users size={19} /></div>
          <div className="confirm-head">
            <h3 className="confirm-title">Split bill</h3>
            <p className="confirm-msg">
              {invoice.merchant} · {money(invoice.total)} · {fmtDate(invoice.dateISO)}
            </p>
          </div>
        </div>

        {!isPremium ? (
          <Card className="panel budget-upsell" data-testid="split-upsell">
            <div className="budget-upsell-icon"><Crown size={22} /></div>
            <h3 className="budget-upsell-title">Bill splitting is a Premium feature</h3>
            <p className="budget-upsell-body">
              Premium lets you assign receipt lines to friends or housemates, with a live
              per-person total and a one-tap WhatsApp export.
            </p>
          </Card>
        ) : state.status === 'loading' ? (
          <p className="confirm-msg">Loading…</p>
        ) : state.status === 'error' ? (
          <p className="confirm-msg" data-testid="split-error">
            Couldn&apos;t load this split — please close and try again.
          </p>
        ) : (
          <>
            <div className="split-section-head">
              <span className="split-section-title">People</span>
            </div>
            <div className="split-participants">
              <button
                type="button"
                className={`split-chip ${activeParticipant === YOU ? 'on' : ''}`}
                onClick={() => setActiveParticipant(YOU)}
                data-testid="split-chip-You"
              >
                <Avatar initials={youInitials} size={22} background={YOU_COLOR} />
                {YOU}
              </button>
              {participants.map((name) => (
                <div
                  key={name}
                  className={`split-chip ${activeParticipant === name ? 'on' : ''}`}
                >
                  <button
                    type="button"
                    className="split-chip-select"
                    onClick={() => setActiveParticipant(name)}
                    data-testid={`split-chip-${name}`}
                  >
                    <Avatar initials={memberInitials({ fullName: name, email: '' })} size={22} background={participantColor(name, namedParticipants)} />
                    {name}
                  </button>
                  <button
                    type="button"
                    className="split-chip-remove"
                    aria-label={`Remove ${name}`}
                    onClick={() => void removeParticipantChip(name)}
                    data-testid={`split-chip-remove-${name}`}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
              <div className="split-add-participant">
                <input
                  className="share-input"
                  placeholder="Add a person…"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); addParticipant() }
                  }}
                  data-testid="split-participant-input"
                />
                <button
                  type="button"
                  className="btn btn--outline"
                  onClick={addParticipant}
                  data-testid="split-add-participant"
                >
                  Add
                </button>
              </div>
            </div>

            <div className="split-section-head">
              <span className="split-section-title">Assign items</span>
              <span className="split-hint">assigning to <strong>{activeParticipant}</strong></span>
            </div>
            <div className="split-lines">
              {state.lines
                .filter((line) => !line.isDiscount && !line.isDepositOrFee)
                .map((line) => {
                  const allocs = allocationsFor(line.id)
                  const assigned = allocs.reduce((sum, a) => sum + a.units, 0)
                  const remainder = line.quantity - assigned
                  const isMulti = line.quantity > 1 + EPSILON
                  const myUnits = unitsFor(line.id, activeParticipant)

                  const owners = [
                    ...allocs.map((a) => ({ name: a.participantName, units: a.units })),
                    ...(remainder > EPSILON ? [{ name: YOU, units: remainder }] : []),
                  ]

                  const isSelected = selectedLineId === line.id

                  return (
                    <div
                      className={`split-line ${isSelected ? 'is-selected' : ''}`}
                      key={line.id}
                      data-testid={`split-line-${line.id}`}
                    >
                      {isMulti ? (
                        <button
                          type="button"
                          className="split-line-row"
                          onClick={() => setSelectedLineId(line.id)}
                          data-testid={`split-select-${line.id}`}
                          aria-label={`${line.rawText}, ${money(line.lineTotal)} — select to edit; use +/− to share units`}
                          aria-pressed={isSelected}
                        >
                          <span className="split-line-name">
                            {line.rawText} <span className="split-line-qty">×{Number(line.quantity)}</span>
                          </span>
                          <span className="split-line-amt">{money(line.lineTotal)}</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="split-line-row"
                          onClick={() => void toggleShare(line)}
                          data-testid={`split-assign-${line.id}`}
                          aria-pressed={isSelected}
                          aria-label={
                            activeParticipant === YOU
                              ? `${line.rawText}, ${money(line.lineTotal)} — tap to add or remove You as a sharer`
                              : `${line.rawText}, ${money(line.lineTotal)} — tap to share with ${activeParticipant}; tap again to remove`
                          }
                        >
                          <span className="split-line-name">{line.rawText}</span>
                          <span className="split-line-amt">{money(line.lineTotal)}</span>
                        </button>
                      )}

                      <div className="split-alloc">
                        <div className="split-owners">
                          {owners.map((o) => (
                            <span className="split-owner" key={o.name} title={`${o.name} ${shareLabel(o.units, line.quantity) || 'full'}`}>
                              <Avatar
                                initials={o.name === YOU ? youInitials : memberInitials({ fullName: o.name, email: '' })}
                                size={22}
                                background={participantColor(o.name, namedParticipants)}
                              />
                              {shareLabel(o.units, line.quantity) && (
                                <span className="split-owner-badge">{shareLabel(o.units, line.quantity)}</span>
                              )}
                            </span>
                          ))}
                        </div>

                        {isMulti && activeParticipant !== YOU && (
                          <div className="split-stepper" data-testid={`split-stepper-${line.id}`}>
                            <button
                              type="button"
                              aria-label={`Remove a ${line.rawText} from ${activeParticipant}`}
                              disabled={myUnits <= EPSILON}
                              onClick={() => void stepUnits(line, -1)}
                              data-testid={`split-minus-${line.id}`}
                            >
                              <Minus size={14} />
                            </button>
                            <span className="split-stepper-val tabular" data-testid={`split-units-${line.id}`}>
                              {Number(myUnits.toFixed(2))}
                            </span>
                            <button
                              type="button"
                              aria-label={`Add a ${line.rawText} to ${activeParticipant}`}
                              disabled={remainder <= EPSILON}
                              onClick={() => void stepUnits(line, 1)}
                              data-testid={`split-plus-${line.id}`}
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                        )}
                        {isMulti && activeParticipant === YOU && allocs.length > 0 && (
                          <button
                            type="button"
                            className="split-reset"
                            onClick={() => void resetLine(line)}
                            aria-label={`Give all of ${line.rawText} back to you`}
                            data-testid={`split-reset-${line.id}`}
                          >
                            <RotateCcw size={13} /> Reset
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
            </div>
            <p className="split-progress">
              {money(assignedToOthers)} of {money(grandTotal)} assigned · use +/− for quantities, tap a single item to share it evenly
            </p>

            <div className="split-summary" data-testid="split-summary">
              {state.summary.participants.map((p) => (
                <div className="store-block" key={p.name}>
                  <div className="store-head">
                    <span className="store-name">
                      <Avatar
                        initials={p.name === YOU ? youInitials : memberInitials({ fullName: p.name, email: '' })}
                        size={22}
                        background={participantColor(p.name, namedParticipants)}
                      />
                      {p.name}
                    </span>
                    <span className="store-subtotal tabular">{money(p.total)}</span>
                  </div>
                  <div className="store-lines">
                    {p.items.map((item) => (
                      <div className="split-item-row" key={item.lineId}>
                        <span className="split-item-name">
                          {item.label} {shareLabel(item.qty, lineQuantityById(item.lineId))}
                        </span>
                        <span className="split-item-amt">{money(item.amount)}</span>
                      </div>
                    ))}
                    <div className="split-item-row">
                      <span className="split-item-name">Fees &amp; charges</span>
                      <span className="split-item-amt">{money(p.fees)}</span>
                    </div>
                  </div>
                </div>
              ))}
              <div className="receipt-grand">
                <span>Total</span>
                <span>{money(state.summary.grandTotal)}</span>
              </div>
            </div>

            <div className="split-section-head">
              <span className="split-section-title">Share this split</span>
            </div>
            {shareUrl ? (
              <div className="share-link" data-testid="split-share-link">
                <input
                  className="share-input"
                  readOnly
                  value={shareUrl}
                  onFocus={(e) => e.currentTarget.select()}
                />
                <a
                  className="btn btn--outline share-copy"
                  href={`https://wa.me/?text=${encodeURIComponent(`Here's how we split ${invoice.merchant}: ${shareUrl}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Share on WhatsApp"
                >
                  <MessageCircle size={15} /> WhatsApp
                </a>
              </div>
            ) : (
              <button
                type="button"
                className="btn btn--outline"
                onClick={() => void shareLink()}
                disabled={sharing}
                data-testid="split-share-create"
              >
                <Link2 size={16} /> {sharing ? 'Creating link…' : 'Create share link'}
              </button>
            )}
            <p className="split-hint" style={{ marginTop: 6 }}>
              A read-only page anyone can open — like sharing a receipt. The link expires in 7 days.
            </p>

            <button
              type="button"
              className="btn whatsapp-btn"
              onClick={() => void copyWhatsapp()}
              data-testid="split-copy-whatsapp"
            >
              <Copy size={18} /> Copy for WhatsApp
            </button>
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}

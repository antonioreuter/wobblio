'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSession } from 'next-auth/react'
import { Copy, Crown, Users, X } from 'lucide-react'
import { Avatar, Card } from '@/components/ds'
import { useWorkspace } from './workspace-provider'
import { fmtDate, fmtMoney, type Invoice } from './invoice-data'
import { useBillSplit, type AssignableLine, type SplitAssignment } from './use-bill-split'
import { deriveInitials } from '@/lib/user-initials'
import { memberInitials } from './household-data'
import { seriesColor } from './trend-data'

const YOU = 'You'
const YOU_COLOR = seriesColor(0)
const FRACTION_CYCLE = [1, 0.5, 1 / 3]
const MAX_PARTICIPANT_NAME_LENGTH = 40

// bill_split_line.fraction is NUMERIC(5,4) — 1/3 round-trips through the backend
// as 0.3333, not JS's 0.3333333333333333 (diff ≈ 3.33e-5). The tolerance must
// comfortably clear that DB-rounding gap while staying tight enough that the three
// cycle values (1, 0.5, 1/3) never collide with each other.
const FRACTION_EPSILON = 1e-3

const canSplitBill = (role: string | undefined): boolean => !!role && role !== 'STANDARD'

// "You" always gets a fixed, stable color; named participants rotate through the
// rest of the palette by their index in `namedParticipants` (participants ∪
// whatever the backend already knows about — see namedParticipants below — so a
// participant with an existing assignment gets a stable color from first paint,
// not just after the participants-growing effect catches up).
function participantColor(name: string, namedParticipants: string[]): string {
  if (name === YOU) return YOU_COLOR
  const idx = namedParticipants.indexOf(name)
  return seriesColor(idx + 1)
}

function fractionLabel(fraction: number): string {
  if (Math.abs(fraction - 0.5) < FRACTION_EPSILON) return '½'
  if (Math.abs(fraction - 1 / 3) < FRACTION_EPSILON) return '⅓'
  return ''
}

function nextFractionAriaHint(fraction: number): string {
  const i = FRACTION_CYCLE.findIndex((f) => Math.abs(f - fraction) < FRACTION_EPSILON)
  if (i + 1 >= FRACTION_CYCLE.length) return 'press again to unassign'
  if (FRACTION_CYCLE[i + 1] === 0.5) return 'press again for half'
  return 'press again for a third'
}

interface BillSplitDialogProps {
  invoice: Invoice
  role: string | undefined
  onClose: () => void
}

export function BillSplitDialog({ invoice, role, onClose }: BillSplitDialogProps) {
  const { showToast } = useWorkspace()
  const { data: session } = useSession()
  const { state, assignLine, unassignLine, removeParticipant, fetchWhatsappText } = useBillSplit(invoice.id)
  const [participants, setParticipants] = useState<string[]>([])
  const [activeParticipant, setActiveParticipant] = useState<string>(YOU)
  const [newName, setNewName] = useState('')

  const youInitials = deriveInitials(session?.user?.name ?? '', session?.user?.email ?? '')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Participants are otherwise only implicit (derived from assignments), but the
  // panel lets you add a name before assigning anything to them — grow the local
  // chip set from whatever the backend already knows about, never shrink it here.
  useEffect(() => {
    if (state.status !== 'ready') return
    const assignedNames = Array.from(new Set(state.assignments.map((a) => a.participantName)))
    setParticipants((prev) => Array.from(new Set([...prev, ...assignedNames])))
  }, [state])

  // Color-index source: participants ∪ whatever the backend already knows about,
  // computed fresh each render rather than relying on the effect above, which
  // otherwise lags one paint behind on first load (a known-assigned participant
  // would briefly index as -1 → the same color as "You").
  const namedParticipants =
    state.status === 'ready'
      ? Array.from(new Set([...participants, ...state.assignments.map((a) => a.participantName)]))
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

  // "You" is the synthetic implicit remainder owner, not a PATCH-able participant —
  // while active, a tap can only give a line back to you (unassign), never cycle a
  // fraction under a literal "You" assignment row.
  const handleLineTap = async (line: AssignableLine, assignment: SplitAssignment | undefined) => {
    try {
      if (activeParticipant === YOU) {
        if (assignment) await unassignLine(line.id)
        return
      }
      if (!assignment || assignment.participantName !== activeParticipant) {
        await assignLine(line.id, activeParticipant, 1)
        return
      }
      const i = FRACTION_CYCLE.findIndex((f) => Math.abs(f - assignment.fraction) < FRACTION_EPSILON)
      if (i + 1 >= FRACTION_CYCLE.length) await unassignLine(line.id)
      else await assignLine(line.id, activeParticipant, FRACTION_CYCLE[i + 1])
    } catch {
      showToast("Couldn't update that line — please try again.", 'danger')
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
              <span className="split-hint">tap → <strong>{activeParticipant}</strong></span>
            </div>
            <div className="split-lines">
              {state.lines
                .filter((line) => !line.isDiscount && !line.isDepositOrFee)
                .map((line) => {
                  const assignment = state.assignments.find((a) => a.lineId === line.id)
                  const ownerName = assignment?.participantName ?? YOU
                  const ownerInitials = ownerName === YOU ? youInitials : memberInitials({ fullName: ownerName, email: '' })
                  const ownerColor = participantColor(ownerName, namedParticipants)
                  const fraction = assignment?.fraction ?? 1
                  const label = assignment
                    ? `${line.rawText}, ${money(line.lineTotal)}, assigned to ${ownerName} ${fraction === 1 ? 'full' : fractionLabel(fraction)} — ${nextFractionAriaHint(fraction)}`
                    : `${line.rawText}, ${money(line.lineTotal)}, unassigned (You) — tap to assign to ${activeParticipant}`
                  return (
                    <div className="split-line" key={line.id}>
                      <button
                        type="button"
                        className="split-line-row"
                        onClick={() => void handleLineTap(line, assignment)}
                        data-testid={`split-assign-${line.id}`}
                        aria-label={label}
                      >
                        <span className="split-line-name">{line.rawText}</span>
                        <span className="split-line-amt">{money(line.lineTotal)}</span>
                        <span style={{ position: 'relative' }}>
                          <Avatar initials={ownerInitials} size={24} background={ownerColor} />
                          {fraction !== 1 && (
                            <span className="split-line-fraction">{fractionLabel(fraction)}</span>
                          )}
                        </span>
                      </button>
                    </div>
                  )
                })}
            </div>
            <p className="split-progress">
              {money(assignedToOthers)} of {money(grandTotal)} assigned · tap a line again for ½ or ⅓
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
                        <span className="split-item-name">{item.label} ×{item.qty}</span>
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

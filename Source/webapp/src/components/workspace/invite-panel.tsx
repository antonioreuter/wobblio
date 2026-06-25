'use client'

import { useState } from 'react'
import { Check, Copy, Link2, X } from 'lucide-react'
import { Button } from '@/components/ds'
import { useWorkspace } from './workspace-provider'
import { fmtDate } from './invoice-data'
import type { GeneratedInvite } from './household-data'

interface InvitePanelProps {
  householdId: string
  // True when the roster is already full (5 members) — minting is disabled.
  atCapacity: boolean
}

// Owner-only invite generator. There is no list-invites endpoint, so the panel
// tracks only the invite it minted this session: generate → copy → revoke.
export function InvitePanel({ householdId, atCapacity }: InvitePanelProps) {
  const { showToast } = useWorkspace()
  const [invite, setInvite] = useState<GeneratedInvite | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  const generate = async () => {
    setBusy(true)
    try {
      const res = await fetch(`/api/households/${householdId}/invite`, { method: 'POST' })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string }
        showToast(body.message ?? 'Couldn’t create an invite — please try again.', 'danger')
        return
      }
      setInvite((await res.json()) as GeneratedInvite)
      setCopied(false)
    } catch {
      showToast('Couldn’t create an invite — please try again.', 'danger')
    } finally {
      setBusy(false)
    }
  }

  const copy = async () => {
    if (!invite) return
    try {
      await navigator.clipboard.writeText(invite.inviteUrl)
      setCopied(true)
      showToast('Invite link copied.', 'success')
    } catch {
      showToast('Couldn’t copy — select the link and copy it manually.', 'danger')
    }
  }

  const revoke = async () => {
    if (!invite) return
    setBusy(true)
    try {
      const res = await fetch(`/api/households/${householdId}/invites/${invite.inviteId}`, {
        method: 'DELETE',
      })
      if (!res.ok && res.status !== 204) {
        showToast('Couldn’t revoke the invite — please try again.', 'danger')
        return
      }
      setInvite(null)
      showToast('Invite revoked.', 'danger')
    } catch {
      showToast('Couldn’t revoke the invite — please try again.', 'danger')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="hh-invite" data-testid="household-invite-panel">
      <div className="hh-invite-head">
        <div className="hh-invite-id">
          <span className="hh-invite-title">Invite a member</span>
          <span className="hh-invite-sub">
            Anyone with the link can join, up to 5 members. Links expire.
          </span>
        </div>
        {!invite && (
          <Button
            iconLeft={<Link2 size={15} />}
            onClick={generate}
            disabled={busy || atCapacity}
            data-testid="household-invite-generate"
          >
            {atCapacity ? 'Household full' : 'Generate link'}
          </Button>
        )}
      </div>

      {invite && (
        <div className="hh-invite-link">
          <input
            type="text"
            className="hh-invite-url"
            readOnly
            value={invite.inviteUrl}
            onFocus={(e) => e.currentTarget.select()}
            aria-label="Invite link"
            data-testid="household-invite-url"
          />
          <span className="hh-invite-token" data-testid="household-invite-token" hidden>
            {invite.token}
          </span>
          <button
            type="button"
            className="btn-icon"
            aria-label="Copy invite link"
            onClick={copy}
            data-testid="household-invite-copy"
          >
            {copied ? <Check size={15} /> : <Copy size={15} />}
          </button>
          <button
            type="button"
            className="btn-icon"
            aria-label="Revoke invite link"
            onClick={revoke}
            disabled={busy}
            data-testid="household-invite-revoke"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {invite && (
        <p className="hh-invite-expiry">Expires {fmtDate(invite.expiresAt)}</p>
      )}
    </div>
  )
}

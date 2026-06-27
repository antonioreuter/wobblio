'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Crown, LogOut, Plus, Trash2, Users } from 'lucide-react'
import { Button, Card, ProgressBar } from '@/components/ds'
import {
  ConfirmDialog,
  CreateHouseholdDialog,
  HouseholdRoster,
  InvitePanel,
  MAX_HOUSEHOLD_MEMBERS,
  fetchDetail,
  fetchMine,
  poolPercent,
  useWorkspace,
  type HouseholdDetail,
  type HouseholdMember,
} from '@/components/workspace'

type DialogState =
  | { kind: 'create' }
  | { kind: 'disband' }
  | { kind: 'leave' }
  | { kind: 'remove'; member: HouseholdMember }
  | null

export default function HouseholdPage() {
  const { data: session } = useSession()
  const { showToast } = useWorkspace()
  // session.user.id is the Cognito sub, but household rows key on the DB app_user.id,
  // so the caller is matched to their roster member by email (carried in the session).
  const email = session?.user?.email
  const role = session?.user?.role
  // PREMIUM plus the elevated operator roles (ADMIN, TESTER) can create households.
  const canCreate = !!role && role !== 'STANDARD'

  const [household, setHousehold] = useState<HouseholdDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [dialog, setDialog] = useState<DialogState>(null)

  // Resolve membership via /mine, then load the detail+pool for that id (only
  // the by-id endpoint carries the weekly pool).
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const mine = await fetchMine()
      setHousehold(mine ? await fetchDetail(mine.id) : null)
    } catch {
      showToast('Couldn’t load your household — please refresh.', 'danger')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => { void load() }, [load])

  const me = household?.members.find((m) => m.email === email)
  const isOwner = !!me?.isOwner

  const disband = async () => {
    if (!household) return
    setDialog(null)
    try {
      const res = await fetch(`/api/households/${household.id}`, { method: 'DELETE' })
      if (!res.ok && res.status !== 204) throw new Error(String(res.status))
      setHousehold(null)
      showToast('Household disbanded.', 'danger')
    } catch {
      showToast('Couldn’t disband the household — please try again.', 'danger')
    }
  }

  const leave = async () => {
    if (!household) return
    setDialog(null)
    try {
      const res = await fetch(`/api/households/${household.id}/leave`, { method: 'POST' })
      if (!res.ok && res.status !== 204) throw new Error(String(res.status))
      setHousehold(null)
      showToast('You left the household.', 'danger')
    } catch {
      showToast('Couldn’t leave the household — please try again.', 'danger')
    }
  }

  const removeMember = async (member: HouseholdMember) => {
    if (!household) return
    setDialog(null)
    try {
      const res = await fetch(`/api/households/${household.id}/members/${member.userId}`, {
        method: 'DELETE',
      })
      if (!res.ok && res.status !== 204) throw new Error(String(res.status))
      await load()
      showToast(`${member.fullName || member.email} was removed.`, 'danger')
    } catch {
      showToast('Couldn’t remove the member — please try again.', 'danger')
    }
  }

  if (loading) return <HouseholdSkeleton />

  if (!household) {
    return (
      <div className="pane">
        <h2 className="pane-title">Household</h2>
        <p className="pane-subtitle">Share a weekly upload pool with the people you shop for.</p>
        {canCreate ? (
          <Card className="panel hh-empty" data-testid="household-empty">
            <div className="hh-empty-icon"><Users size={22} /></div>
            <h3 className="hh-empty-title">Start a household</h3>
            <p className="hh-empty-body">
              Invite up to {MAX_HOUSEHOLD_MEMBERS} members and pool 15 extra uploads each week
              (active once a second member joins), on top of everyone’s personal scans.
            </p>
            <Button
              iconLeft={<Plus size={15} />}
              onClick={() => setDialog({ kind: 'create' })}
              data-testid="household-create"
            >
              Create household
            </Button>
          </Card>
        ) : (
          <Card className="panel hh-upsell" data-testid="household-upsell">
            <div className="hh-upsell-icon"><Crown size={22} /></div>
            <h3 className="hh-upsell-title">Join or start a household</h3>
            <p className="hh-upsell-body">
              Have an invite link? Open it to join your household. Creating a household is a
              Premium feature — upgrade to host one and unlock the shared upload pool.
            </p>
          </Card>
        )}

        {dialog?.kind === 'create' && (
          <CreateHouseholdDialog onClose={() => setDialog(null)} onCreated={load} />
        )}
      </div>
    )
  }

  const pct = poolPercent(household.pool)
  const used = household.pool?.used ?? 0
  const unlimitedPool = household.pool?.unlimited ?? false
  const cap = unlimitedPool ? '∞' : (household.pool?.cap ?? 0)
  const atCapacity = household.members.length >= MAX_HOUSEHOLD_MEMBERS

  return (
    <div className="pane">
      <div className="pane-head-row">
        <div>
          <h2 className="pane-title">{household.name}</h2>
          <p className="pane-subtitle">
            <span className="tabular">{household.members.length}</span> / {MAX_HOUSEHOLD_MEMBERS}{' '}
            members · shared weekly upload pool.
          </p>
        </div>
        {isOwner ? (
          <Button
            variant="outline"
            iconLeft={<Trash2 size={15} />}
            onClick={() => setDialog({ kind: 'disband' })}
            data-testid="household-disband"
          >
            Disband
          </Button>
        ) : (
          <Button
            variant="outline"
            iconLeft={<LogOut size={15} />}
            onClick={() => setDialog({ kind: 'leave' })}
            data-testid="household-leave"
          >
            Leave
          </Button>
        )}
      </div>

      <Card className="panel hh-pool" data-testid="household-pool">
        <div className="hh-pool-head">
          <span className="hh-pool-title">Household upload pool</span>
          <span className="hh-pool-count tabular">
            {used} / {cap} <span className="hh-pool-unit">used this week</span>
          </span>
        </div>
        <ProgressBar value={pct} ariaLabel={`Household pool ${pct}% used`} animate />
      </Card>

      <Card className="panel">
        <HouseholdRoster
          members={household.members}
          currentUserId={me?.userId}
          onRemove={isOwner ? (m) => setDialog({ kind: 'remove', member: m }) : undefined}
        />
      </Card>

      {isOwner && <InvitePanel householdId={household.id} atCapacity={atCapacity} />}

      {dialog?.kind === 'disband' && (
        <ConfirmDialog
          title="Disband this household?"
          message="All members lose access to the shared pool and household-space invoices. Household receipts already saved stay with the household owner. This can’t be undone."
          confirmLabel="Disband household"
          onConfirm={disband}
          onCancel={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'leave' && (
        <ConfirmDialog
          title="Leave this household?"
          message="You’ll lose access to the shared upload pool and household-space invoices. The owner can re-invite you later."
          confirmLabel="Leave household"
          onConfirm={leave}
          onCancel={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'remove' && (
        <ConfirmDialog
          title="Remove this member?"
          message={`${dialog.member.fullName || dialog.member.email} will lose access to the shared pool and household-space invoices.`}
          confirmLabel="Remove member"
          onConfirm={() => removeMember(dialog.member)}
          onCancel={() => setDialog(null)}
        />
      )}
    </div>
  )
}

function HouseholdSkeleton() {
  return (
    <div className="pane">
      <h2 className="pane-title">Household</h2>
      <p className="pane-subtitle">Loading your household…</p>
      <Card className="panel">
        <span className="sk sk-line" style={{ width: 200, height: 13 }} />
        <span className="sk sk-line" style={{ width: '100%', height: 8, marginTop: 16 }} />
        <span className="sk sk-line" style={{ width: 160, height: 11, marginTop: 16 }} />
      </Card>
    </div>
  )
}

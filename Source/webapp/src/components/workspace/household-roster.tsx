'use client'

import { UserMinus } from 'lucide-react'
import { Avatar, Badge } from '@/components/ds'
import { memberInitials, type HouseholdMember } from './household-data'

interface HouseholdRosterProps {
  members: HouseholdMember[]
  // The signed-in user; their own row is never removable and shows a "You" hint.
  currentUserId?: string
  // Owner-only: remove a non-owner member. Omitted for non-owners.
  onRemove?: (member: HouseholdMember) => void
}

export function HouseholdRoster({ members, currentUserId, onRemove }: HouseholdRosterProps) {
  return (
    <div className="hh-roster" data-testid="household-roster">
      {members.map((m) => {
        const name = m.fullName.trim() || m.email
        const isSelf = m.userId === currentUserId
        const removable = !!onRemove && !m.isOwner
        return (
          <div className="hh-member" key={m.userId} data-testid={`household-member-${m.userId}`}>
            <Avatar initials={memberInitials(m)} size={40} />
            <div className="hh-member-id">
              <span className="hh-member-name">
                {name}
                {isSelf && <span className="hh-member-you"> · You</span>}
              </span>
              <span className="hh-member-email">{m.email}</span>
            </div>
            {m.isOwner && <Badge tone="primary">Owner</Badge>}
            <span className="hh-member-uploads tabular" title="Uploads this week">
              {m.uploadsThisWeek} <span className="hh-member-uploads-unit">this week</span>
            </span>
            {removable && (
              <button
                type="button"
                className="btn-icon"
                aria-label={`Remove ${name}`}
                onClick={() => onRemove?.(m)}
                data-testid={`household-remove-${m.userId}`}
              >
                <UserMinus size={15} />
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}

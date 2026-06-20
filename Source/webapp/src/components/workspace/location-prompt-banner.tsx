'use client'

import { MapPin } from 'lucide-react'

interface LocationPromptBannerProps {
  count: number
  onConfirm: () => void
}

// Surfaces parsed receipts still held out of the regional price index because their
// location is unconfirmed (§6.5). Persistent (not dismissible) — it's a real
// outstanding task that clears itself once every pending receipt is confirmed.
// Confirm routes to the first pending invoice's drawer, where the location gate lives.
export function LocationPromptBanner({ count, onConfirm }: LocationPromptBannerProps) {
  if (count <= 0) return null

  const noun = count === 1 ? 'receipt needs' : 'receipts need'

  return (
    <div className="loc-prompt" data-testid="location-prompt-banner">
      <span className="loc-prompt-icon"><MapPin size={16} /></span>
      <span className="loc-prompt-text">
        <strong>{count}</strong> {noun} a location to share prices with the regional index.
      </span>
      <button
        type="button"
        className="loc-prompt-btn"
        onClick={onConfirm}
        data-testid="location-prompt-confirm"
      >
        Confirm
      </button>
    </div>
  )
}

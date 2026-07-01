'use client'

import { useState } from 'react'
import { Link2, MessageCircle } from 'lucide-react'
import { useWorkspace } from './workspace-provider'
import { createListShare } from './list-data'

interface ShareListBarProps {
  listId: string
  listName: string
}

// Sticky share bar on the list detail screen (§10b) — mirrors the bill-split
// bottom action bar: a WhatsApp deep link + a primary "copy link" action, both
// backed by the same weblink (no separate per-store text export). The share
// token is issued once and reused for subsequent taps in this session.
export function ShareListBar({ listId, listName }: ShareListBarProps) {
  const { showToast } = useWorkspace()
  const [url, setUrl] = useState<string | null>(null)
  const [issuing, setIssuing] = useState(false)

  const ensureShare = async (): Promise<string | null> => {
    if (url) return url
    setIssuing(true)
    try {
      const share = await createListShare(listId)
      setUrl(share.url)
      return share.url
    } catch {
      showToast('Couldn’t create a share link — please try again.', 'danger')
      return null
    } finally {
      setIssuing(false)
    }
  }

  const copyLink = async () => {
    const link = await ensureShare()
    if (!link) return
    await navigator.clipboard.writeText(link)
    showToast('Link copied.', 'success')
  }

  const shareWhatsApp = async () => {
    const link = await ensureShare()
    if (!link) return
    const text = encodeURIComponent(`${listName} — my Wobblio shopping list: ${link}`)
    window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="share-bar" data-testid="share-list-bar">
      <button
        type="button"
        className="share-bar-whatsapp"
        aria-label="Share via WhatsApp"
        onClick={shareWhatsApp}
        disabled={issuing}
        data-testid="share-list-whatsapp"
      >
        <MessageCircle size={18} />
      </button>
      <button
        type="button"
        className="btn btn--primary share-bar-copy"
        onClick={copyLink}
        disabled={issuing}
        data-testid="share-list-copy"
      >
        <Link2 size={15} /> {issuing ? 'Preparing link…' : 'Copy list link'}
      </button>
    </div>
  )
}

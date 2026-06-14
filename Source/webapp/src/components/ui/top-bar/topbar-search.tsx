'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'

export function TopBarSearch() {
  const router = useRouter()
  const [query, setQuery] = useState('')

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = query.trim()
    if (!trimmed) return
    router.push(`/invoices?q=${encodeURIComponent(trimmed)}`)
  }

  return (
    <form className="search-wrap" role="search" onSubmit={onSubmit}>
      <Search size={16} />
      <input
        type="search"
        className="app-search"
        placeholder="Search invoices by tag, merchant, product…"
        aria-label="Search invoices"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        data-testid="topbar-search"
      />
    </form>
  )
}

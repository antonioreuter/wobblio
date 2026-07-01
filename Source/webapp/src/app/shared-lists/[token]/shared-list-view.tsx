'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Check, ListChecks } from 'lucide-react'
import { Card, WobblioLogo, ThemeToggle } from '@/components/ds'
import { SHOPPING_LIST_CATEGORY_LABELS, type ShoppingListCategoryId } from '@/components/workspace/list-data'

export interface SharedListItem {
  id: string
  freeText: string
  quantity: number
  checked: boolean
}

export interface SharedList {
  name: string
  categoryId: string
  items: SharedListItem[]
}

function categoryLabel(categoryId: string): string {
  return SHOPPING_LIST_CATEGORY_LABELS[categoryId as ShoppingListCategoryId] ?? categoryId
}

export function SharedListView({ token, initialList }: { token: string; initialList: SharedList | null }) {
  const [list, setList] = useState(initialList)

  const toggle = async (itemId: string, checked: boolean) => {
    if (!list) return
    const prev = list
    setList({ ...list, items: list.items.map((it) => (it.id === itemId ? { ...it, checked } : it)) })
    const res = await fetch(`/api/shared-lists/${encodeURIComponent(token)}/items/${encodeURIComponent(itemId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ checked }),
    })
    if (!res.ok) setList(prev)
  }

  if (!list) {
    return (
      <div className="min-h-screen flex flex-col bg-bg text-primary">
        <nav className="border-b border-glass-border bg-glass-bg backdrop-blur-md">
          <div className="mx-auto flex max-w-6xl h-16 items-center justify-between px-4 sm:px-6">
            <Link href="/" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
              <WobblioLogo size={32} withWordmark />
            </Link>
            <ThemeToggle />
          </div>
        </nav>
        <main className="flex-1 flex items-center justify-center px-4 py-12">
          <Card className="w-full max-w-md text-center p-8 flex flex-col items-center gap-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-danger-glow text-danger">
              <AlertTriangle size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight mb-2">This link isn’t available</h1>
              <p className="text-sm text-secondary leading-relaxed" data-testid="share-list-invalid">
                The share link is invalid or has expired. Ask the sender for a fresh one.
              </p>
            </div>
            <Link href="/" className="btn btn--primary w-full mt-2">
              Go to Wobblio
            </Link>
          </Card>
        </main>
      </div>
    )
  }

  const boughtCount = list.items.filter((it) => it.checked).length

  return (
    <div className="min-h-screen flex flex-col bg-bg text-primary">
      <nav className="sticky top-0 z-50 w-full border-b border-glass-border bg-glass-bg/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl h-16 items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
            <WobblioLogo size={32} withWordmark />
          </Link>
          <ThemeToggle />
        </div>
      </nav>

      <main className="flex-1 max-w-2xl w-full mx-auto px-4 sm:px-6 py-6 md:py-12" data-testid="shared-list">
        <div className="mb-6 md:mb-8">
          <div className="flex items-center gap-2 text-xs font-semibold text-brand uppercase tracking-wider mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
            Shared Shopping List
          </div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight bg-gradient-heading bg-clip-text text-transparent">
            {list.name}
          </h1>
          <p className="text-sm text-secondary mt-1">
            {categoryLabel(list.categoryId)} · {boughtCount}/{list.items.length} bought
          </p>
        </div>

        <Card className="p-4 sm:p-6 flex flex-col gap-1">
          {list.items.length === 0 ? (
            <div className="text-center py-10 text-muted italic bg-glass-highlight rounded-xl border border-glass-border">
              <ListChecks size={20} className="mx-auto mb-2" />
              This list has no items yet.
            </div>
          ) : (
            list.items.map((item) => (
              <div className={`list-item ${item.checked ? 'list-item--done' : ''}`} key={item.id} data-testid="shared-list-item">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={item.checked}
                  aria-label={`Mark ${item.freeText} as ${item.checked ? 'not bought' : 'bought'}`}
                  className={`list-check ${item.checked ? 'list-check--on' : ''}`}
                  onClick={() => toggle(item.id, !item.checked)}
                  data-testid="shared-list-item-check"
                >
                  {item.checked && <Check size={13} strokeWidth={3} />}
                </button>
                <span className="list-item-text" style={{ cursor: 'default' }}>{item.freeText}</span>
                {item.quantity > 1 && <span className="store-line-qty tabular">×{item.quantity}</span>}
              </div>
            ))
          )}
        </Card>
      </main>

      <footer className="py-8 border-t border-glass-border bg-glass-bg/30 text-center text-xs text-muted mt-12">
        Shared via{' '}
        <Link href="/" className="text-brand font-semibold hover:underline">
          Wobblio
        </Link>
      </footer>
    </div>
  )
}

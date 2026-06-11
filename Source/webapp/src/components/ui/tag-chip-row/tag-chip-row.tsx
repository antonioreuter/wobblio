'use client'

import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { cn } from '@/lib/cn'

interface TagChipRowProps {
  tags: string[]
  onAddTag?: (tag: string) => void
  onRemoveTag?: (tag: string) => void
  vocabulary?: string[]
  readOnly?: boolean
  className?: string
}

export function TagChipRow({
  tags,
  onAddTag,
  onRemoveTag,
  vocabulary = [],
  readOnly = false,
  className,
}: TagChipRowProps) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [search, setSearch] = useState('')

  const filtered = vocabulary.filter(
    (v) => !tags.includes(v) && v.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className={cn('relative flex flex-wrap gap-1.5', className)}>
      {tags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 rounded-full bg-[#ccfbf1] px-2.5 py-1 text-xs font-medium text-[#0d9488]"
        >
          {tag}
          {!readOnly && onRemoveTag && (
            <button
              onClick={() => onRemoveTag(tag)}
              className="ml-0.5 hover:text-[#0f766e]"
              aria-label={`Remove tag ${tag}`}
            >
              <X size={10} strokeWidth={2} />
            </button>
          )}
        </span>
      ))}

      {!readOnly && (
        <div className="relative">
          <button
            onClick={() => setPickerOpen((o) => !o)}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-[#cbd5e1] px-2.5 py-1 text-xs text-[#64748b] hover:border-[#0d9488] hover:text-[#0d9488] dark:border-[#334155] dark:text-[#94a3b8]"
            aria-expanded={pickerOpen}
            aria-haspopup="listbox"
          >
            <Plus size={10} strokeWidth={2} />
            Add tag
          </button>

          {pickerOpen && (
            <div
              className="absolute left-0 top-8 z-50 min-w-[180px] rounded-[8px] border border-[#e2e8f0] bg-white p-2 shadow-lg dark:border-[#334155] dark:bg-[#111827]"
              role="listbox"
            >
              <input
                type="text"
                placeholder="Search tags…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="mb-2 w-full rounded border border-[#e2e8f0] px-2 py-1 text-xs focus:outline-none dark:border-[#334155] dark:bg-[#1e293b] dark:text-[#f1f5f9]"
                autoFocus
              />
              <ul className="max-h-40 overflow-y-auto">
                {filtered.map((v) => (
                  <li key={v}>
                    <button
                      role="option"
                      aria-selected={false}
                      onClick={() => {
                        onAddTag?.(v)
                        setPickerOpen(false)
                        setSearch('')
                      }}
                      className="w-full rounded px-2 py-1 text-left text-xs text-[#0f172a] hover:bg-[#f1f5f9] dark:text-[#f1f5f9] dark:hover:bg-[#1e293b]"
                    >
                      {v}
                    </button>
                  </li>
                ))}
                {filtered.length === 0 && (
                  <li className="px-2 py-1 text-xs text-[#64748b]">No tags found</li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

'use client'

import { useRef, useCallback } from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface Column<T> {
  key: keyof T | string
  header: string
  numeric?: boolean
  render?: (row: T) => React.ReactNode
  className?: string
}

interface DataTableProps<T extends { id: string }> {
  columns: Column<T>[]
  rows: T[]
  onRowClick?: (row: T) => void
  emptyState?: React.ReactNode
  className?: string
  'data-testid'?: string
}

function getCellValue<T>(row: T, key: keyof T | string): React.ReactNode {
  return String((row as Record<string, unknown>)[key as string] ?? '')
}

export function DataTable<T extends { id: string }>({
  columns,
  rows,
  onRowClick,
  emptyState,
  className,
  'data-testid': testId,
}: DataTableProps<T>) {
  const tbodyRef = useRef<HTMLTableSectionElement>(null)

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTableRowElement>, row: T) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onRowClick?.(row)
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        const next = e.currentTarget.nextElementSibling as HTMLTableRowElement | null
        next?.focus()
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        const prev = e.currentTarget.previousElementSibling as HTMLTableRowElement | null
        prev?.focus()
      }
    },
    [onRowClick]
  )

  return (
    <div
      className={cn('w-full overflow-auto', className)}
      data-testid={testId ?? 'data-table'}
    >
      {/* Desktop table */}
      <table className="hidden w-full border-collapse text-sm md:table">
        <thead className="sticky top-0 z-10 bg-bg ">
          <tr>
            {columns.map((col) => (
              <th
                key={String(col.key)}
                className={cn(
                  'border-b border-line px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted  ',
                  col.numeric && 'text-right',
                  col.className
                )}
              >
                {col.header}
              </th>
            ))}
            {onRowClick && <th className="w-8 border-b border-line " />}
          </tr>
        </thead>
        <tbody ref={tbodyRef}>
          {rows.length === 0 && emptyState ? (
            <tr>
              <td colSpan={columns.length + (onRowClick ? 1 : 0)} className="py-0">
                {emptyState}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={row.id}
                className={cn(
                  'border-b border-line ',
                  onRowClick &&
                    'cursor-pointer hover:bg-brand-soft focus:bg-brand-soft focus:outline-none  '
                )}
                onClick={() => onRowClick?.(row)}
                onKeyDown={(e) => handleKeyDown(e, row)}
                tabIndex={onRowClick ? 0 : undefined}
                role={onRowClick ? 'button' : undefined}
                aria-label={onRowClick ? `View row ${row.id}` : undefined}
              >
                {columns.map((col) => (
                  <td
                    key={String(col.key)}
                    className={cn(
                      'px-3 py-3 text-fg ',
                      col.numeric && 'numeric-cell tabular',
                      col.className
                    )}
                  >
                    {col.render ? col.render(row) : getCellValue(row, col.key)}
                  </td>
                ))}
                {onRowClick && (
                  <td className="px-2 py-3 text-right text-muted ">
                    <ChevronRight size={14} strokeWidth={1.5} aria-hidden />
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* Mobile card list */}
      <ul className="flex flex-col gap-2 md:hidden" role="list">
        {rows.length === 0 && emptyState ? (
          <li>{emptyState}</li>
        ) : (
          rows.map((row) => (
            <li key={row.id}>
              <button
                className="w-full rounded-[12px] border border-line bg-card p-3 text-left hover:border-brand  "
                onClick={() => onRowClick?.(row)}
              >
                <div className="flex items-start justify-between gap-2">
                  {columns.slice(0, 2).map((col) => (
                    <span
                      key={String(col.key)}
                      className={cn(
                        'text-sm text-fg ',
                        col.numeric && 'tabular font-medium'
                      )}
                    >
                      {col.render ? col.render(row) : getCellValue(row, col.key)}
                    </span>
                  ))}
                </div>
                {columns.slice(2).map((col) => (
                  <span
                    key={String(col.key)}
                    className="mt-1 block text-xs text-muted "
                  >
                    {col.render ? col.render(row) : getCellValue(row, col.key)}
                  </span>
                ))}
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  )
}

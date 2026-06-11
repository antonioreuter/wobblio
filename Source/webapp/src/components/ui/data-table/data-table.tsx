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
        <thead className="sticky top-0 z-10 bg-[#f8fafc] dark:bg-[#111827]">
          <tr>
            {columns.map((col) => (
              <th
                key={String(col.key)}
                className={cn(
                  'border-b border-[#e2e8f0] px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[#64748b] dark:border-[#334155] dark:text-[#94a3b8]',
                  col.numeric && 'text-right',
                  col.className
                )}
              >
                {col.header}
              </th>
            ))}
            {onRowClick && <th className="w-8 border-b border-[#e2e8f0] dark:border-[#334155]" />}
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
                  'border-b border-[#e2e8f0] dark:border-[#334155]',
                  onRowClick &&
                    'cursor-pointer hover:bg-[#f0fdfc] focus:bg-[#f0fdfc] focus:outline-none dark:hover:bg-[#0d9488]/10 dark:focus:bg-[#0d9488]/10'
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
                      'px-3 py-3 text-[#0f172a] dark:text-[#f1f5f9]',
                      col.numeric && 'numeric-cell tabular',
                      col.className
                    )}
                  >
                    {col.render ? col.render(row) : getCellValue(row, col.key)}
                  </td>
                ))}
                {onRowClick && (
                  <td className="px-2 py-3 text-right text-[#64748b] dark:text-[#94a3b8]">
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
                className="w-full rounded-[12px] border border-[#e2e8f0] bg-white p-3 text-left hover:border-[#0d9488] dark:border-[#334155] dark:bg-[#111827]"
                onClick={() => onRowClick?.(row)}
              >
                <div className="flex items-start justify-between gap-2">
                  {columns.slice(0, 2).map((col) => (
                    <span
                      key={String(col.key)}
                      className={cn(
                        'text-sm text-[#0f172a] dark:text-[#f1f5f9]',
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
                    className="mt-1 block text-xs text-[#64748b] dark:text-[#94a3b8]"
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

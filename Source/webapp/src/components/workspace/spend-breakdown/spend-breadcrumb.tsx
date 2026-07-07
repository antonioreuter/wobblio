'use client'

import { ChevronRight } from 'lucide-react'

export interface SpendCrumb {
  label: string
  // depth to truncate the drill path back to when clicked (0 = root "All spend")
  depth: number
}

interface SpendBreadcrumbProps {
  crumbs: SpendCrumb[]
  onNavigate: (depth: number) => void
}

// Drill trail: "All spend › Groceries › Jumbo › Dairy & Eggs". Every crumb but the last is a
// button that truncates the selection back to that depth, preserving the active filters.
export function SpendBreadcrumb({ crumbs, onNavigate }: SpendBreadcrumbProps) {
  return (
    <nav className="spend-breadcrumb" aria-label="Spend drill path" data-testid="spend-breadcrumb">
      {crumbs.map((crumb, i) => {
        const isLast = i === crumbs.length - 1
        return (
          <span className="spend-crumb" key={`${crumb.depth}-${crumb.label}`}>
            {isLast ? (
              <span className="spend-crumb-current" aria-current="page">{crumb.label}</span>
            ) : (
              <button
                type="button"
                className="spend-crumb-link"
                onClick={() => onNavigate(crumb.depth)}
                data-testid={`spend-crumb-${crumb.depth}`}
              >
                {crumb.label}
              </button>
            )}
            {!isLast && <ChevronRight size={14} className="spend-crumb-sep" />}
          </span>
        )
      })}
    </nav>
  )
}

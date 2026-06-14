'use client'

import { ChevronDown } from 'lucide-react'
import type { ChangeEvent, ReactNode } from 'react'

interface FilterSelectProps {
  label: string
  icon?: ReactNode
  value: string
  onChange: (e: ChangeEvent<HTMLSelectElement>) => void
  children: ReactNode
}

export function FilterSelect({ label, icon, value, onChange, children }: FilterSelectProps) {
  return (
    <div className="filter-field">
      <label className="filter-label">{label}</label>
      <div className="filter-wrap">
        {icon && <span className="lead-icon">{icon}</span>}
        <select className="filter-select" value={value} onChange={onChange}>
          {children}
        </select>
        <span className="chevron"><ChevronDown size={14} /></span>
      </div>
    </div>
  )
}

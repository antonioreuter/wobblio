'use client'

import React, { createContext, useContext, useState } from 'react'

export interface ShoppingItem {
  id: string
  name: string
  quantity: number
  checked: boolean
}

export interface InvoiceRow {
  id: string
  date: string
  merchant: string
  category: string
  categoryColor: string
  items: number
  total: number
  status: 'confirmed' | 'auto' | 'low'
}

interface SandboxContextType {
  isRlsEnforced: boolean
  toggleRls: () => void
  showWarningBanner: boolean
  dismissWarningBanner: () => void
  listItems: ShoppingItem[]
  setListItems: React.Dispatch<React.SetStateAction<ShoppingItem[]>>
  invoices: InvoiceRow[]
  setInvoices: React.Dispatch<React.SetStateAction<InvoiceRow[]>>
  reloadSeedData: () => void
}

const DEFAULT_ITEMS: ShoppingItem[] = [
  { id: '1', name: 'Organic Whole Milk 1L', quantity: 2, checked: false },
  { id: '2', name: 'Organic Avocados', quantity: 3, checked: true },
  { id: '3', name: 'Sourdough Bread 800g', quantity: 1, checked: false },
]

const DEFAULT_INVOICES: InvoiceRow[] = [
  {
    id: '1',
    date: '2026-06-11',
    merchant: 'Albert Heijn',
    category: 'Groceries',
    categoryColor: '#0d9488',
    items: 14,
    total: 47.85,
    status: 'confirmed',
  },
  {
    id: '2',
    date: '2026-06-10',
    merchant: 'Praxis',
    category: 'Home & Garden',
    categoryColor: '#7c3aed',
    items: 3,
    total: 124.0,
    status: 'low',
  },
  {
    id: '3',
    date: '2026-06-09',
    merchant: 'Vapiano',
    category: 'Dining',
    categoryColor: '#ea580c',
    items: 5,
    total: 38.5,
    status: 'auto',
  },
]

const SandboxContext = createContext<SandboxContextType | undefined>(undefined)

export function SandboxProvider({ children }: { children: React.ReactNode }) {
  const [isRlsEnforced, setIsRlsEnforced] = useState(true)
  const [showWarningBanner, setShowWarningBanner] = useState(false)
  const [listItems, setListItems] = useState<ShoppingItem[]>(DEFAULT_ITEMS)
  const [invoices, setInvoices] = useState<InvoiceRow[]>(DEFAULT_INVOICES)

  const toggleRls = () => {
    setIsRlsEnforced((prev) => {
      const next = !prev
      if (!next) {
        setShowWarningBanner(true)
      } else {
        setShowWarningBanner(false)
      }
      return next
    })
  }

  const dismissWarningBanner = () => {
    setShowWarningBanner(false)
  }

  const reloadSeedData = () => {
    setListItems(DEFAULT_ITEMS)
    setInvoices(DEFAULT_INVOICES)
    setIsRlsEnforced(true)
    setShowWarningBanner(false)
    // Clear custom uploads/simulated receipts from memory if any
    if (typeof window !== 'undefined') {
      localStorage.removeItem('wobblio_simulated_receipt')
    }
  }

  // Load/save from localStorage for persistence if desired, but defaults are fine
  return (
    <SandboxContext.Provider
      value={{
        isRlsEnforced,
        toggleRls,
        showWarningBanner,
        dismissWarningBanner,
        listItems,
        setListItems,
        invoices,
        setInvoices,
        reloadSeedData,
      }}
    >
      {children}
    </SandboxContext.Provider>
  )
}

export function useSandbox() {
  const context = useContext(SandboxContext)
  if (!context) {
    throw new Error('useSandbox must be used within a SandboxProvider')
  }
  return context
}

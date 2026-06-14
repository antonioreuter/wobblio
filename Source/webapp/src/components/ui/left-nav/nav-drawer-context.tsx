'use client'

import { createContext, useCallback, useContext, useState } from 'react'

interface NavDrawerState {
  open: boolean
  openDrawer: () => void
  closeDrawer: () => void
  toggleDrawer: () => void
}

const NavDrawerContext = createContext<NavDrawerState | null>(null)

export function NavDrawerProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const openDrawer = useCallback(() => setOpen(true), [])
  const closeDrawer = useCallback(() => setOpen(false), [])
  const toggleDrawer = useCallback(() => setOpen((prev) => !prev), [])

  return (
    <NavDrawerContext.Provider value={{ open, openDrawer, closeDrawer, toggleDrawer }}>
      {children}
    </NavDrawerContext.Provider>
  )
}

export function useNavDrawer(): NavDrawerState {
  const ctx = useContext(NavDrawerContext)
  if (!ctx) throw new Error('useNavDrawer must be used within a NavDrawerProvider')
  return ctx
}

'use client'

import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'light' | 'dark' | 'system'

interface ThemeContextValue {
  theme: Theme
  resolvedTheme: 'light' | 'dark'
  setTheme: (theme: Theme) => void
}

const STORAGE_KEY = 'wobblio-admin-theme'
const ThemeContext = createContext<ThemeContextValue | null>(null)

// Dark-first, mirroring the webapp. The resolved theme is written to
// data-theme on <html>; all surfaces theme off that via CSS variables.
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark')
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('dark')

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null
    if (stored) setThemeState(stored)
  }, [])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const resolve = (t: Theme): 'light' | 'dark' =>
      t === 'system' ? (mediaQuery.matches ? 'dark' : 'light') : t
    const apply = (resolved: 'light' | 'dark') => {
      document.documentElement.setAttribute('data-theme', resolved)
      setResolvedTheme(resolved)
    }
    apply(resolve(theme))
    const listener = () => theme === 'system' && apply(resolve('system'))
    mediaQuery.addEventListener('change', listener)
    return () => mediaQuery.removeEventListener('change', listener)
  }, [theme])

  function setTheme(t: Theme) {
    localStorage.setItem(STORAGE_KEY, t)
    setThemeState(t)
  }

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>{children}</ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}

'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/components/providers/theme-provider'

export interface ThemeToggleProps {
  className?: string
  testId?: string
}

export function ThemeToggle({ className = 'btn-icon', testId = 'theme-toggle' }: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  // Until mounted, the resolved theme isn't known on the client (it's read from
  // localStorage in an effect), so render a stable icon to avoid a hydration
  // mismatch, then swap to the real state once mounted.
  const isDark = mounted && resolvedTheme === 'dark'

  const toggle = () => {
    const next = isDark ? 'light' : 'dark'
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const startViewTransition = (document as Document & {
      startViewTransition?: (cb: () => void) => void
    }).startViewTransition

    // Cross-fade the whole page when supported; the data-theme flip happens
    // synchronously inside the transition so it's captured in the snapshot.
    if (startViewTransition && !reduced) {
      startViewTransition.call(document, () => {
        document.documentElement.setAttribute('data-theme', next)
        setTheme(next)
      })
      return
    }
    setTheme(next)
  }

  return (
    <button
      type="button"
      className={className}
      onClick={toggle}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      data-testid={testId}
    >
      {isDark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  )
}

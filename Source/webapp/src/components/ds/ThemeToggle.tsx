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

  return (
    <button
      type="button"
      className={className}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      data-testid={testId}
    >
      {isDark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  )
}

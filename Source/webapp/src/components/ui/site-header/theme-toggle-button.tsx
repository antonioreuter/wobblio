'use client'

import { Sun, Moon } from 'lucide-react'
import { useTheme } from '@/components/providers/theme-provider'

export function ThemeToggleButton() {
  const { resolvedTheme, setTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  return (
    <button
      type="button"
      className="btn-icon"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      data-testid="header-theme-toggle"
    >
      {isDark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  )
}

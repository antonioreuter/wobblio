import Link from 'next/link'
import { ThemeToggle, WobblioLogo } from '@/components/ds'

type Variant = 'landing' | 'auth' | 'app'

interface SiteHeaderProps {
  variant: Variant
}

export function SiteHeader({ variant }: SiteHeaderProps) {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link href="/" className="site-brand" aria-label="Wobblio home">
          <WobblioLogo size={32} />
          <span className="site-brand-wordmark">
            wobbl<span>io</span>
          </span>
        </Link>
        <nav className="site-nav-group">
          <SiteHeaderActions variant={variant} />
          <ThemeToggle testId="header-theme-toggle" />
        </nav>
      </div>
    </header>
  )
}

function SiteHeaderActions({ variant }: { variant: Variant }) {
  if (variant === 'landing') {
    return (
      <div className="auth-cta">
        <Link href="/login" className="btn btn--text" data-testid="header-login">
          Log in
        </Link>
        <Link
          href="/register"
          className="btn btn--primary"
          style={{ padding: '9px 18px' }}
          data-testid="header-get-started"
        >
          Get started
        </Link>
      </div>
    )
  }
  if (variant === 'app') {
    return (
      <Link
        href="/dashboard"
        className="btn open-ws-btn"
        style={{ padding: '9px 18px' }}
        data-testid="header-open-workspace"
      >
        Open workspace
      </Link>
    )
  }
  return null
}

import Link from 'next/link'

export function SiteFooter() {
  const year = new Date().getFullYear()
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <span className="footer-copy">
          © {year} Wobblio · Eindhoven, NL · Built on AWS
        </span>
        <div className="footer-links">
          <Link href="/privacy">Privacy</Link>
          <Link href="/gdpr">GDPR</Link>
          <Link href="/terms">Terms</Link>
        </div>
      </div>
    </footer>
  )
}

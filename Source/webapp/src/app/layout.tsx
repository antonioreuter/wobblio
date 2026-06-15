import type { Metadata } from 'next'
import { Inter, Outfit } from 'next/font/google'
import { ThemeProvider } from '@/components/providers/theme-provider'
import { SandboxProvider } from '@/components/providers/sandbox-provider'
import { AuroraBackground } from '@/components/ds'
import './globals.css'

const SANDBOX_ENABLED = process.env.NEXT_PUBLIC_SANDBOX_MODE === 'true'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Wobblio',
  description: 'Cloud-native personal fiscal management',
}

// Force dynamic rendering app-wide. The middleware applies a per-request
// nonce CSP (script-src 'nonce-…' 'strict-dynamic'); a nonce makes the browser
// ignore 'unsafe-inline', so statically-prerendered pages (whose inline scripts
// carry no runtime nonce) fail to hydrate. Dynamic rendering lets Next.js stamp
// the request nonce onto its scripts. Required for nonce-based CSP to work.
export const dynamic = 'force-dynamic'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${outfit.variable}`} suppressHydrationWarning>
      <body>
        <ThemeProvider>
          {SANDBOX_ENABLED ? (
            <SandboxProvider>
              <AuroraBackground />
              <div className="kit">{children}</div>
            </SandboxProvider>
          ) : (
            <>
              <AuroraBackground />
              <div className="kit">{children}</div>
            </>
          )}
        </ThemeProvider>
      </body>
    </html>
  )
}

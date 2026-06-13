import type { Metadata } from 'next'
import { Inter, Outfit } from 'next/font/google'
import { ThemeProvider } from '@/components/providers/theme-provider'
import { SandboxProvider } from '@/components/providers/sandbox-provider'
import { AuroraBackground } from '@/components/ds'
import './globals.css'

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${outfit.variable}`} suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <SandboxProvider>
            <AuroraBackground />
            <div className="kit">{children}</div>
          </SandboxProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}

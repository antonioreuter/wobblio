import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { ThemeProvider } from '@/components/providers/theme-provider'
import { SandboxProvider } from '@/components/providers/sandbox-provider'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Wobblio',
  description: 'Cloud-native personal fiscal management',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <SandboxProvider>
            {children}
          </SandboxProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}

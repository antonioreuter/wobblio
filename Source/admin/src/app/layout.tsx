import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/providers/theme-provider'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' })

export const metadata: Metadata = {
  title: 'Wobblio Admin',
  description: 'Wobblio internal admin console — admin.wobblio.com',
}

// Set data-theme before first paint (no flash). Dark is the default; a stored
// preference overrides it.
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('wobblio-admin-theme');var d=t==='light'?'light':(t==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):'dark');document.documentElement.setAttribute('data-theme',d);}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}

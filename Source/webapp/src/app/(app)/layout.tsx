'use client'

import { useState } from 'react'
import { LeftNav } from '@/components/ui/left-nav'
import { TopBar } from '@/components/ui/top-bar'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [activePage, setActivePage] = useState<'dashboard' | 'invoices' | 'reports' | 'lists' | 'budgets' | 'household' | 'settings'>('dashboard')

  return (
    <div className="flex h-screen overflow-hidden bg-[#f8fafc] dark:bg-[#0b0f19]">
      <LeftNav
        activePage={activePage}
        onNavigate={setActivePage}
        className="hidden xl:flex"
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar quotaUsed={7} quotaLimit={10} />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-[1440px]">{children}</div>
        </main>
      </div>
    </div>
  )
}

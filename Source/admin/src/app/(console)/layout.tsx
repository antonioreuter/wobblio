import { Shield } from 'lucide-react'
import { WobblioLogo } from '@/components/ui/logo'

const NAV_ITEMS = [
  { href: '/',          label: 'Hub' },
  { href: '/config',    label: 'SSM Config' },
  { href: '/models',    label: 'Model Matrix' },
  { href: '/waitlist',  label: 'Waitlist' },
  { href: '/dlq',       label: 'DLQ' },
  { href: '/curation',  label: 'Alias Curation' },
  { href: '/ai-spend',  label: 'AI Spend' },
  { href: '/kpis',      label: 'KPIs' },
]

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-[#f8fafc]">
      {/* Admin sidebar */}
      <nav
        className="flex w-56 shrink-0 flex-col border-r border-[#e2e8f0] bg-white"
        aria-label="Admin navigation"
      >
        <div className="flex h-14 items-center gap-2 border-b border-[#e2e8f0] px-4">
          <WobblioLogo className="h-6 w-6" />
          <span className="font-semibold text-[#0f172a]">
            wobbl<span className="text-electric-indigo">io</span>
            <span className="ml-1 text-[10px] font-bold uppercase tracking-wider text-rose-500 bg-rose-500/10 px-1 py-0.5 rounded">admin</span>
          </span>
        </div>
        <ul className="flex flex-col gap-0.5 p-2" role="list">
          {NAV_ITEMS.map(({ href, label }) => (
            <li key={href}>
              <a
                href={href}
                className="flex items-center rounded-[8px] px-3 py-2 text-sm text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#0f172a]"
              >
                {label}
              </a>
            </li>
          ))}
        </ul>
        <div className="mt-auto border-t border-[#e2e8f0] p-3">
          <span className="inline-flex items-center gap-1 rounded-full bg-[#fee2e2] px-2 py-0.5 text-xs font-medium text-[#dc2626]">
            ADMIN
          </span>
        </div>
      </nav>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center border-b border-[#e2e8f0] bg-white px-6">
          <div className="flex items-center gap-1.5">
            <WobblioLogo className="h-5 w-5" />
            <span className="text-sm font-bold text-[#0f172a]">
              wobbl<span className="text-electric-indigo">io</span> <span className="text-slate-400">Admin</span>
            </span>
          </div>
          <span className="ml-auto text-xs text-[#64748b]">admin.wobblio.com</span>
        </header>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  )
}

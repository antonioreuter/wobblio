import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'

interface NavItemProps {
  icon: LucideIcon
  label: string
  active?: boolean
  collapsed?: boolean
  onClick?: () => void
  href?: string
}

export function NavItem({ icon: IconComp, label, active, collapsed, onClick }: NavItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'group relative flex w-full items-center gap-3 rounded-[8px] px-3 py-2 text-sm transition-colors',
        active
          ? 'bg-[#f0fdfc] font-semibold text-[#0d9488] dark:bg-[#0d9488]/10 dark:text-[#0d9488]'
          : 'text-[#64748b] hover:bg-[#f8fafc] hover:text-[#0f172a] dark:text-[#94a3b8] dark:hover:bg-[#1e293b] dark:hover:text-[#f1f5f9]',
        collapsed && 'justify-center px-2'
      )}
      aria-current={active ? 'page' : undefined}
      title={collapsed ? label : undefined}
    >
      {active && (
        <span
          className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-[#0d9488]"
          aria-hidden
        />
      )}
      <IconComp
        size={20}
        strokeWidth={1.5}
        className={cn(
          'shrink-0',
          active ? 'text-[#0d9488]' : 'text-[#64748b] group-hover:text-[#0f172a] dark:text-[#94a3b8] dark:group-hover:text-[#f1f5f9]'
        )}
        aria-hidden
      />
      {!collapsed && <span className="truncate">{label}</span>}
    </button>
  )
}

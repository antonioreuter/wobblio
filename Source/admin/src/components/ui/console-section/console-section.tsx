import type { LucideIcon } from 'lucide-react'

interface ConsoleSectionProps {
  id: string
  icon: LucideIcon
  title: string
  description?: string
  headerAside?: React.ReactNode
  children: React.ReactNode
}

// Shared frame for a console page section: an icon-badged header with an optional
// aside (status pill / counts) and the section body below. `scroll-mt` keeps the
// anchor target clear of the sticky topbar when jumped to.
export function ConsoleSection({
  id,
  icon: Icon,
  title,
  description,
  headerAside,
  children,
}: ConsoleSectionProps) {
  return (
    <section id={id} className="flex scroll-mt-20 flex-col gap-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-brand-soft text-brand">
          <Icon size={18} strokeWidth={1.5} />
        </span>
        <div className="flex flex-1 flex-col gap-0.5">
          <h2 className="text-lg font-semibold text-fg">{title}</h2>
          {description && <p className="text-sm text-muted">{description}</p>}
        </div>
        {headerAside}
      </div>
      {children}
    </section>
  )
}

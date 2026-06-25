import { WaitlistSection } from './waitlist-section'
import { ConfigSection } from './config-section'
import { ModelsSection } from './models-section'
import { QuotasSection } from './quotas-section'

const SECTION_LINKS = [
  { id: 'waitlist', label: 'Waitlist' },
  { id: 'quotas', label: 'Quotas' },
  { id: 'config', label: 'SSM Config' },
  { id: 'models', label: 'Model Matrix' },
]

export default function PlatformPage() {
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-fg">Platform Controls</h1>
          <p className="text-sm text-muted">
            Capacity, runtime parameters, and model routing — the operational levers, in one place.
          </p>
        </div>
        <nav className="flex flex-wrap gap-2" aria-label="Section shortcuts">
          {SECTION_LINKS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="rounded-full border border-line bg-card px-3 py-1 text-xs font-medium text-muted transition-colors hover:border-brand hover:text-fg"
            >
              {s.label}
            </a>
          ))}
        </nav>
      </header>

      <WaitlistSection />
      <div className="h-px bg-line" />
      <QuotasSection />
      <div className="h-px bg-line" />
      <ConfigSection />
      <div className="h-px bg-line" />
      <ModelsSection />
    </div>
  )
}

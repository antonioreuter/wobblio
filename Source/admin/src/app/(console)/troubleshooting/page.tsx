import { QueueHealthSection } from './queue-health-section'
import { LogLevelSection } from './log-level-section'
import { LogsSection } from './logs-section'
import { DlqSection } from './dlq-section'

const SECTION_LINKS = [
  { id: 'health', label: 'Queue Health' },
  { id: 'loglevel', label: 'Log Level' },
  { id: 'logs', label: 'Ingestion Logs' },
  { id: 'dlq', label: 'Dead Letter Queue' },
]

export default function TroubleshootingPage() {
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-fg">Troubleshooting</h1>
          <p className="text-sm text-muted">
            Diagnose the invoice-processing pipeline — queue health, worker logs, log level, and failed messages.
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

      <QueueHealthSection />
      <div className="h-px bg-line" />
      <LogLevelSection />
      <div className="h-px bg-line" />
      <LogsSection />
      <div className="h-px bg-line" />
      <DlqSection />
    </div>
  )
}

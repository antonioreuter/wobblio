const SECTIONS = [
  { href: '/config',   title: 'SSM Config',      desc: 'Edit runtime parameters and feature caps' },
  { href: '/models',   title: 'Model Matrix',     desc: 'Swap AI model IDs for each pipeline role' },
  { href: '/waitlist', title: 'Waitlist',         desc: 'View queue size and release users' },
  { href: '/dlq',      title: 'DLQ',              desc: 'Inspect, replay, or discard failed messages' },
  { href: '/curation', title: 'Alias Curation',   desc: 'Approve, merge, or reject provisional merchants and products' },
  { href: '/ai-spend', title: 'AI Spend',         desc: 'Token usage and cost by model role' },
  { href: '/kpis',     title: 'KPIs',             desc: 'Registrations, DAU, MAU, MRR, churn' },
]

export default function AdminHubPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-fg">Admin Console</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SECTIONS.map(({ href, title, desc }) => (
          <a
            key={href}
            href={href}
            className="rounded-[12px] border border-line bg-card p-5 hover:border-brand hover:shadow-sm transition-all"
          >
            <p className="text-sm font-semibold text-fg">{title}</p>
            <p className="mt-1 text-xs text-muted">{desc}</p>
          </a>
        ))}
      </div>
    </div>
  )
}

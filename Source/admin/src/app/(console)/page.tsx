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
      <h1 className="text-2xl font-bold text-[#0f172a]">Admin Console</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SECTIONS.map(({ href, title, desc }) => (
          <a
            key={href}
            href={href}
            className="rounded-[12px] border border-[#e2e8f0] bg-white p-5 hover:border-[#0d9488] hover:shadow-sm transition-all"
          >
            <p className="text-sm font-semibold text-[#0f172a]">{title}</p>
            <p className="mt-1 text-xs text-[#64748b]">{desc}</p>
          </a>
        ))}
      </div>
    </div>
  )
}

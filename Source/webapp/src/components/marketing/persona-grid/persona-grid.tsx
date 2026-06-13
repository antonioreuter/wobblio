import { Globe, Users, GraduationCap, TrendingUp, Split, MapPin } from 'lucide-react'

const PERSONAS = [
  {
    id: 'traveler',
    title: 'Traveler',
    headline: 'Three countries, one budget',
    hook: '"Every receipt converted on the day you paid — not when the bank felt like it."',
    description: 'Converts foreign receipts on transaction date, eliminating credit card settlement lag.',
    Icon: Globe,
  },
  {
    id: 'family-cfo',
    title: 'Family CFO',
    headline: 'One family, one picture',
    hook: '"Household allocation pool keeps everyone on track."',
    description: 'Merges multiple uploads into a shared monthly quota pool with custom categories.',
    Icon: Users,
  },
  {
    id: 'student',
    title: 'Student',
    headline: 'Same basket, 22% cheaper',
    hook: '"Discover invisible leaks and split house costs."',
    description: 'Shows cost disparities between adjacent stores and supports WhatsApp split shares.',
    Icon: GraduationCap,
  },
  {
    id: 'inflation-hunter',
    title: 'Inflation Hunter',
    headline: 'Inflation is personal',
    hook: '"Your personal price engine tells the real story."',
    description: 'Tracks actual price trends of items you buy, bypassing generalized public indices.',
    Icon: TrendingUp,
  },
  {
    id: 'friend-group',
    title: 'Friend Group',
    headline: 'One photo. Tap who had what.',
    hook: '"Fair group split — including service and tip — in 30 seconds."',
    description: 'Vision extraction maps proportional bills. Exports direct WhatsApp charge sheets.',
    Icon: Split,
  },
  {
    id: 'border-shopper',
    title: 'Border Shopper',
    headline: 'Cross-Border Check',
    hook: '"Is the drive across the border still worth it?"',
    description: 'Tracks tax and grocery price differentials between bordering countries.',
    Icon: MapPin,
  },
]

export function PersonaGrid() {
  return (
    <section data-testid="persona-grid" className="py-16">
      <div className="mx-auto max-w-6xl px-4">
        <h2 className="mb-10 text-center text-3xl font-bold tracking-tight text-[#0f172a] dark:text-[#f1f5f9]">
          Built for how you actually live
        </h2>
        <ul className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {PERSONAS.map(({ id, title, headline, hook, description, Icon }) => (
            <li
              key={id}
              className="glass-card flex flex-col p-6 transition-all duration-300 hover:scale-[1.02] hover:shadow-premium-glow"
              data-testid={`persona-${id}`}
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-[8px] bg-electric-indigo/10 text-electric-indigo dark:bg-electric-indigo/20">
                <Icon className="h-5 w-5" strokeWidth={1.5} />
              </div>
              <span className="text-xs font-semibold uppercase tracking-wider text-aurora-teal">
                {title}
              </span>
              <h3 className="mt-1 text-xl font-bold text-[#0f172a] dark:text-[#f1f5f9]">
                {headline}
              </h3>
              <p className="mt-2 text-sm italic text-[#64748b] dark:text-[#94a3b8]">
                {hook}
              </p>
              <p className="mt-3 text-sm text-[#475569] dark:text-[#cbd5e1] flex-1">
                {description}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

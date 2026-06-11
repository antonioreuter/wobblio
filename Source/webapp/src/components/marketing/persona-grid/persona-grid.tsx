const PERSONAS = [
  {
    title: 'Families',
    tagline: 'One family, one picture of the money.',
    body: 'Alerts before the budget breaks — not a post-mortem after.',
    emoji: '👨‍👩‍👧‍👦',
  },
  {
    title: 'Smart shoppers',
    tagline: 'Same basket, two streets apart, 22% cheaper.',
    body: 'Your receipts knew — now you do.',
    emoji: '🛒',
  },
  {
    title: 'Friends',
    tagline: 'One photo. Tap who had what.',
    body: 'Fair split — including the tip — in your group chat in 30 seconds.',
    emoji: '🧑‍🤝‍🧑',
  },
  {
    title: 'Travelers',
    tagline: 'Three countries, one budget.',
    body: 'Every receipt converted on the day you paid — not the day your bank felt like it.',
    emoji: '✈️',
  },
];

export function PersonaGrid() {
  return (
    <section data-testid="persona-grid" className="py-16">
      <h2 className="mb-10 text-center text-2xl font-semibold">Built for how you actually live</h2>
      <ul className="mx-auto grid max-w-4xl grid-cols-1 gap-6 sm:grid-cols-2">
        {PERSONAS.map(({ title, tagline, body, emoji }) => (
          <li
            key={title}
            className="rounded-xl border border-[#e2e8f0] p-6 dark:border-[#1e293b]"
            data-testid={`persona-${title.toLowerCase().replace(/\s+/g, '-')}`}
          >
            <span className="mb-3 block text-3xl" aria-hidden="true">{emoji}</span>
            <h3 className="mb-1 font-semibold">{title}</h3>
            <p className="mb-1 text-sm font-medium text-[#0d9488]">{tagline}</p>
            <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">{body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

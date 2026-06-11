const STEPS = [
  {
    emoji: '📸',
    title: 'Snap',
    body: 'Photograph any receipt — even crumpled thermal paper.',
  },
  {
    emoji: '✨',
    title: 'Done',
    body: 'AI extracts every item, price, and store in seconds; you just confirm.',
    microcopy: 'Spot a mistake? One tap fixes it — and Wobblio learns.',
  },
  {
    emoji: '📊',
    title: 'Save',
    body: 'Budgets fill themselves, prices get compared, lists get smarter.',
  },
];

export function HowItWorks() {
  return (
    <section data-testid="how-it-works" className="py-16">
      <h2 className="mb-10 text-center text-2xl font-semibold">How it works</h2>
      <ol className="mx-auto grid max-w-3xl grid-cols-1 gap-8 sm:grid-cols-3">
        {STEPS.map(({ emoji, title, body, microcopy }, i) => (
          <li key={i} className="flex flex-col items-center text-center">
            <span className="mb-3 text-4xl" aria-hidden="true">{emoji}</span>
            <h3 className="mb-2 font-semibold">{title}</h3>
            <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">{body}</p>
            {microcopy && (
              <p className="mt-2 text-xs italic text-[#64748b] dark:text-[#94a3b8]">{microcopy}</p>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

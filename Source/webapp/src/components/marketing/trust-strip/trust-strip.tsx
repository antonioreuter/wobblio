const CLAIMS = [
  { icon: '🔒', text: 'No bank connection required' },
  { icon: '🇪🇺', text: 'GDPR-compliant, EU-hosted, delete everything anytime' },
  { icon: '🛡️', text: 'Your data stays yours — only anonymous price points are shared.' },
];

export function TrustStrip() {
  return (
    <section data-testid="trust-strip" className="border-y border-[#e2e8f0] dark:border-[#1e293b] py-6">
      <ul className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center sm:gap-10">
        {CLAIMS.map(({ icon, text }) => (
          <li key={text} className="flex items-center gap-2 text-sm text-[#64748b] dark:text-[#94a3b8]">
            <span aria-hidden="true">{icon}</span>
            {text}
          </li>
        ))}
      </ul>
    </section>
  );
}

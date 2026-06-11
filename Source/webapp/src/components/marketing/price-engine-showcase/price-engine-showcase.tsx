export function PriceEngineShowcase() {
  return (
    <section data-testid="price-engine-showcase" className="py-16 bg-[#f8fafc] dark:bg-[#111827]">
      <div className="mx-auto max-w-4xl px-4">
        <h2 className="mb-4 text-center text-2xl font-semibold">Anti-Inflation Price Engine</h2>
        <p className="mb-8 text-center text-[#64748b] dark:text-[#94a3b8]">
          Real prices from real receipts in your area — including the in-store promos no website lists.
        </p>

        {/* Static chart placeholder */}
        <div
          className="mb-6 flex h-48 items-center justify-center rounded-xl border border-dashed border-[#cbd5e1] bg-white dark:border-[#334155] dark:bg-[#0b0f19]"
          aria-label="6-month price comparison chart"
          role="img"
        >
          <span className="text-sm text-[#94a3b8]">📊 6-month price chart (real data as area grows)</span>
        </div>

        <p className="text-center text-xs text-[#64748b] dark:text-[#94a3b8]">
          Comparisons unlock as your area&apos;s data grows — every scan makes it smarter.
        </p>
      </div>
    </section>
  );
}

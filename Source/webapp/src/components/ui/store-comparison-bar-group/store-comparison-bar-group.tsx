import { Money } from '@/components/ui/money'
import { cn } from '@/lib/cn'

interface StoreBar {
  store: string
  price: number
  currency?: string
}

interface StoreComparisonBarGroupProps {
  product: string
  bars: StoreBar[]
  className?: string
}

export function StoreComparisonBarGroup({
  product,
  bars,
  className,
}: StoreComparisonBarGroupProps) {
  const max = Math.max(...bars.map((b) => b.price))

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <p className="text-xs font-semibold uppercase tracking-wide text-[#64748b] dark:text-[#94a3b8]">
        {product}
      </p>
      {bars.map((bar) => {
        const pct = (bar.price / max) * 100
        const isCheapest = bar.price === Math.min(...bars.map((b) => b.price))
        return (
          <div key={bar.store} className="flex items-center gap-2">
            <span className="w-24 shrink-0 truncate text-xs text-[#0f172a] dark:text-[#f1f5f9]">
              {bar.store}
            </span>
            <div className="relative h-5 flex-1 rounded-full bg-[#f1f5f9] dark:bg-[#1e293b]">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  isCheapest ? 'bg-[#0d9488]' : 'bg-[#94a3b8]'
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
            <Money
              amount={bar.price}
              currency={bar.currency}
              size="secondary"
              className="w-16 text-right text-[#0f172a] dark:text-[#f1f5f9]"
            />
          </div>
        )
      })}
    </div>
  )
}

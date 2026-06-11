import { Check, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Money } from '@/components/ui/money'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/cn'

interface UpgradeCheckoutFlowProps {
  onSelectPlan?: (plan: 'monthly' | 'annual') => void
  defaultPlan?: 'monthly' | 'annual'
  className?: string
}

const features = [
  'Unlimited receipt scans',
  'Budget tracking & alerts',
  'Price intelligence — compare across Eindhoven stores',
  'Shopping list optimizer',
  'Reports & insights',
  'Household sharing (up to 5 members)',
  'Priority support',
]

export function UpgradeCheckoutFlow({
  onSelectPlan,
  defaultPlan = 'annual',
  className,
}: UpgradeCheckoutFlowProps) {
  return (
    <div
      className={cn('flex min-h-screen flex-col items-center justify-center p-6', className)}
      data-testid="upgrade-checkout-flow"
    >
      <div className="w-full max-w-2xl">
        <div className="mb-8 text-center">
          <Zap size={32} strokeWidth={1.5} className="mx-auto mb-3 text-[#0d9488]" aria-hidden />
          <h1 className="text-[24px] font-bold text-[#0f172a] dark:text-[#f1f5f9]">
            Upgrade to Premium
          </h1>
          <p className="mt-2 text-sm text-[#64748b] dark:text-[#94a3b8]">
            Full fiscal intelligence for your household. Every scan gets smarter.
          </p>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Monthly */}
          <Card
            className={cn(
              'cursor-pointer border-2 transition-colors',
              defaultPlan === 'monthly'
                ? 'border-[#0d9488]'
                : 'border-[#e2e8f0] hover:border-[#0d9488]/50 dark:border-[#334155]'
            )}
            padding="lg"
          >
            <div className="flex flex-col gap-3">
              <div>
                <p className="text-sm font-semibold text-[#0f172a] dark:text-[#f1f5f9]">Monthly</p>
                <div className="mt-1 flex items-baseline gap-1">
                  <Money amount={4.99} size="display" className="text-[#0f172a] dark:text-[#f1f5f9]" />
                  <span className="text-sm text-[#64748b] dark:text-[#94a3b8]">/month</span>
                </div>
              </div>
              <Button
                variant={defaultPlan === 'monthly' ? 'primary' : 'secondary'}
                size="md"
                className="w-full"
                onClick={() => onSelectPlan?.('monthly')}
              >
                Choose Monthly
              </Button>
            </div>
          </Card>

          {/* Annual */}
          <Card
            className={cn(
              'cursor-pointer border-2 transition-colors',
              defaultPlan === 'annual'
                ? 'border-[#0d9488]'
                : 'border-[#e2e8f0] hover:border-[#0d9488]/50 dark:border-[#334155]'
            )}
            padding="lg"
          >
            <div className="flex flex-col gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-[#0f172a] dark:text-[#f1f5f9]">Annual</p>
                  <Badge variant="success">2 months free</Badge>
                </div>
                <div className="mt-1 flex items-baseline gap-1">
                  <Money amount={3.99} size="display" className="text-[#0f172a] dark:text-[#f1f5f9]" />
                  <span className="text-sm text-[#64748b] dark:text-[#94a3b8]">/month</span>
                </div>
                <p className="mt-0.5 text-xs text-[#64748b] dark:text-[#94a3b8]">
                  Billed €47.88/year
                </p>
              </div>
              <Button
                variant={defaultPlan === 'annual' ? 'primary' : 'secondary'}
                size="md"
                className="w-full"
                onClick={() => onSelectPlan?.('annual')}
              >
                Choose Annual
              </Button>
            </div>
          </Card>
        </div>

        {/* Feature comparison */}
        <Card padding="md">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#64748b] dark:text-[#94a3b8]">
            Everything included
          </p>
          <ul className="flex flex-col gap-2">
            {features.map((f) => (
              <li key={f} className="flex items-center gap-2 text-sm text-[#0f172a] dark:text-[#f1f5f9]">
                <Check size={14} strokeWidth={2} className="shrink-0 text-[#0d9488]" aria-hidden />
                {f}
              </li>
            ))}
          </ul>
        </Card>

        <p className="mt-4 text-center text-xs text-[#64748b] dark:text-[#94a3b8]">
          Secure checkout via Stripe · Cancel anytime · No in-app purchases
        </p>
      </div>
    </div>
  )
}

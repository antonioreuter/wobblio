import { Clock, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/cn'

interface WaitlistScreenProps {
  position: number
  estimatedDays?: number
  onSkipToPremium?: () => void
  className?: string
}

export function WaitlistScreen({
  position,
  estimatedDays,
  onSkipToPremium,
  className,
}: WaitlistScreenProps) {
  return (
    <div
      className={cn('flex min-h-screen flex-col items-center justify-center p-6', className)}
      data-testid="waitlist-screen"
    >
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-[#0d9488]">
            Wobblio
          </p>
          <h1 className="text-[24px] font-bold text-[#0f172a] dark:text-[#f1f5f9]">
            You&apos;re on the list
          </h1>
          <p className="mt-2 text-sm text-[#64748b] dark:text-[#94a3b8]">
            Wobblio is launching in Eindhoven. We&apos;re onboarding in small batches to keep
            the price data sharp.
          </p>
        </div>

        <Card className="mb-4 text-center" padding="lg">
          <div className="flex flex-col items-center gap-2">
            <Clock size={32} strokeWidth={1.5} className="text-[#64748b] dark:text-[#94a3b8]" aria-hidden />
            <p className="text-xs font-medium uppercase tracking-wide text-[#64748b] dark:text-[#94a3b8]">
              Your position
            </p>
            <p
              className="text-[48px] font-bold leading-none text-[#0f172a] dark:text-[#f1f5f9]"
              style={{ fontVariantNumeric: 'tabular-nums' }}
              data-testid="waitlist-position"
            >
              #{position}
            </p>
            {estimatedDays !== undefined && (
              <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">
                ~{estimatedDays} day{estimatedDays !== 1 ? 's' : ''} estimated wait
              </p>
            )}
          </div>
        </Card>

        {onSkipToPremium && (
          <Card padding="md" className="border-[#0d9488]/30 bg-[#f0fdfc] dark:bg-[#0d9488]/10">
            <div className="flex items-start gap-3">
              <Zap size={20} strokeWidth={1.5} className="mt-0.5 shrink-0 text-[#0d9488]" aria-hidden />
              <div className="flex flex-col gap-2">
                <p className="text-sm font-semibold text-[#0f172a] dark:text-[#f1f5f9]">
                  Skip the line — go Premium
                </p>
                <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">
                  Premium members get instant access, unlimited scans, budget tracking, and price
                  intelligence across all of Eindhoven.
                </p>
                <Button variant="primary" size="md" onClick={onSkipToPremium}>
                  Upgrade to Premium
                </Button>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}

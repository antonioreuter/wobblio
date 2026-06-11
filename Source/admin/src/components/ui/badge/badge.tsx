import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/cn'

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
  {
    variants: {
      variant: {
        brand: 'bg-[#ccfbf1] text-[#0d9488]',
        success: 'bg-[#dcfce7] text-[#16a34a]',
        warning: 'bg-[#fef3c7] text-[#d97706]',
        error: 'bg-[#fee2e2] text-[#dc2626]',
        muted: 'bg-[#f1f5f9] text-[#64748b] dark:bg-[#1e293b] dark:text-[#94a3b8]',
        outline: 'border border-[#e2e8f0] text-[#64748b] dark:border-[#334155] dark:text-[#94a3b8]',
      },
    },
    defaultVariants: {
      variant: 'muted',
    },
  }
)

interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

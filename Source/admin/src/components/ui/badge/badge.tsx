import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/cn'

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
  {
    variants: {
      variant: {
        brand: 'bg-brand-soft text-brand',
        success: 'bg-success-soft text-success',
        warning: 'bg-warning-soft text-warning',
        error: 'bg-danger-soft text-danger',
        muted: 'bg-elevated text-muted  ',
        outline: 'border border-line text-muted  ',
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

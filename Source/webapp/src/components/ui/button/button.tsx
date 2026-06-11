import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/cn'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0d9488] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary:
          'bg-[#0d9488] text-white hover:bg-[#0f766e] rounded-[8px]',
        secondary:
          'bg-white text-[#0f172a] border border-[#e2e8f0] hover:bg-[#f8fafc] rounded-[8px] dark:bg-[#1e293b] dark:text-[#f1f5f9] dark:border-[#334155] dark:hover:bg-[#293548]',
        ghost:
          'text-[#64748b] hover:text-[#0f172a] hover:bg-[#f1f5f9] rounded-[8px] dark:hover:text-[#f1f5f9] dark:hover:bg-[#1e293b]',
        destructive:
          'bg-[#dc2626] text-white hover:bg-[#b91c1c] rounded-[8px]',
        outline:
          'border border-[#0d9488] text-[#0d9488] hover:bg-[#ccfbf1] rounded-[8px]',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-10 px-4 text-sm',
        lg: 'h-12 px-6 text-base',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
)

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <button className={cn(buttonVariants({ variant, size }), className)} {...props} />
  )
}

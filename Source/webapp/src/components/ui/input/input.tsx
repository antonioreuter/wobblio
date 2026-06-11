import { cn } from '@/lib/cn'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  helper?: string
  error?: string
}

export function Input({ label, helper, error, className, id, ...props }: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label
          htmlFor={inputId}
          className="text-xs font-medium text-[#0f172a] dark:text-[#f1f5f9]"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={cn(
          'h-10 w-full rounded-[8px] border border-[#e2e8f0] bg-white px-3 text-sm text-[#0f172a]',
          'placeholder:text-[#64748b]',
          'focus:border-[#0d9488] focus:outline-none focus:ring-2 focus:ring-[#0d9488]/20',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'dark:border-[#334155] dark:bg-[#111827] dark:text-[#f1f5f9] dark:placeholder:text-[#94a3b8]',
          error && 'border-[#dc2626] focus:border-[#dc2626] focus:ring-[#dc2626]/20',
          className
        )}
        aria-invalid={!!error}
        aria-describedby={error ? `${inputId}-error` : helper ? `${inputId}-helper` : undefined}
        {...props}
      />
      {error && (
        <p id={`${inputId}-error`} className="text-xs text-[#dc2626]" role="alert">
          {error}
        </p>
      )}
      {!error && helper && (
        <p id={`${inputId}-helper`} className="text-xs text-[#64748b] dark:text-[#94a3b8]">
          {helper}
        </p>
      )}
    </div>
  )
}

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
          className="text-xs font-medium text-fg "
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={cn(
          'h-10 w-full rounded-[8px] border border-line bg-card px-3 text-sm text-fg',
          'placeholder:text-muted',
          'focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20',
          'disabled:cursor-not-allowed disabled:opacity-50',
          '   ',
          error && 'border-danger focus:border-danger focus:ring-danger/20',
          className
        )}
        aria-invalid={!!error}
        aria-describedby={error ? `${inputId}-error` : helper ? `${inputId}-helper` : undefined}
        {...props}
      />
      {error && (
        <p id={`${inputId}-error`} className="text-xs text-danger" role="alert">
          {error}
        </p>
      )}
      {!error && helper && (
        <p id={`${inputId}-helper`} className="text-xs text-muted ">
          {helper}
        </p>
      )}
    </div>
  )
}

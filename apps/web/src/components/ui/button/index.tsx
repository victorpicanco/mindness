import { cva, type VariantProps } from 'class-variance-authority'
import type { ButtonHTMLAttributes } from 'react'

import { Spinner } from '@/components/ui/spinner'

const buttonStyles = cva(
  'inline-flex cursor-pointer items-center justify-center gap-2 rounded-full font-sans font-medium transition-[background-color,border-color,box-shadow,transform] duration-200 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text disabled:cursor-not-allowed disabled:opacity-70',
  {
    variants: {
      variant: {
        primary: 'bg-text text-surface hover:opacity-85',
        secondary:
          'border border-border bg-transparent text-text hover:-translate-y-px hover:border-text-muted hover:bg-surface-raised hover:shadow-sm',
        destructive: 'bg-error text-surface hover:opacity-85',
      },
      size: {
        sm: 'min-h-8 px-3 text-sm',
        md: 'min-h-10 px-4 text-sm',
        lg: 'min-h-14 px-6 py-4 text-base',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
)

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonStyles> & {
    isLoading?: boolean
  }

export function Button({
  children,
  className,
  disabled,
  isLoading = false,
  size,
  variant,
  ...props
}: ButtonProps) {
  return (
    <button
      aria-busy={isLoading || undefined}
      className={buttonStyles({ className, size, variant })}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span aria-hidden="true">
          <Spinner />
        </span>
      ) : null}
      {children}
    </button>
  )
}

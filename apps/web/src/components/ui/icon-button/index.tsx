import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentPropsWithRef } from 'react'

import { Icon } from '@/components/ui/icon'

const iconButtonStyles = cva(
  'grid shrink-0 cursor-pointer place-items-center transition-[background-color,color,opacity] duration-200 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text disabled:cursor-not-allowed disabled:opacity-70',
  {
    variants: {
      variant: {
        ghost: 'rounded-[0.875rem] text-text-muted hover:bg-input hover:text-text',
        solid: 'rounded-full bg-text text-surface hover:opacity-85',
      },
      size: {
        md: 'size-10 text-xl',
        lg: 'size-12 text-2xl',
      },
    },
    defaultVariants: {
      variant: 'ghost',
      size: 'md',
    },
  },
)

type IconButtonProps = Omit<ComponentPropsWithRef<'button'>, 'children'> &
  VariantProps<typeof iconButtonStyles> & {
    readonly icon: string
    readonly label: string
  }

export function IconButton({ className, icon, label, size, variant, ...props }: IconButtonProps) {
  return (
    <button
      aria-label={label}
      className={iconButtonStyles({ className, size, variant })}
      type="button"
      {...props}
    >
      <Icon className="text-[1em]" name={icon} />
    </button>
  )
}

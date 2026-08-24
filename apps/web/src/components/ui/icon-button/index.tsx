import type { ComponentPropsWithRef } from 'react'

import { Icon } from '@/components/ui/icon'

type IconButtonProps = Omit<ComponentPropsWithRef<'button'>, 'children'> & {
  readonly icon: string
  readonly label: string
}

const ICON_BUTTON_CLASSES =
  'grid size-10 shrink-0 cursor-pointer place-items-center rounded-[0.875rem] text-text-muted transition-colors hover:bg-input hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text'

export function IconButton({ className, icon, label, ...props }: IconButtonProps) {
  return (
    <button
      aria-label={label}
      className={
        className === undefined ? ICON_BUTTON_CLASSES : `${ICON_BUTTON_CLASSES} ${className}`
      }
      type="button"
      {...props}
    >
      <Icon name={icon} />
    </button>
  )
}

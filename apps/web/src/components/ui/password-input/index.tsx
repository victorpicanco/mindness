'use client'

import { useState, type ComponentPropsWithRef } from 'react'

import { Icon } from '@/components/ui/icon'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/ui/class-names'

type PasswordInputProps = Omit<ComponentPropsWithRef<'input'>, 'type'> & {
  readonly hidePasswordLabel: string
  readonly showPasswordLabel: string
}

export function PasswordInput({
  className,
  hidePasswordLabel,
  showPasswordLabel,
  ...props
}: PasswordInputProps) {
  const [isVisible, setIsVisible] = useState(false)
  const toggleLabel = isVisible ? hidePasswordLabel : showPasswordLabel

  return (
    <div className="relative">
      <Input {...props} className={cn(className, 'pr-14')} type={isVisible ? 'text' : 'password'} />
      <button
        aria-label={toggleLabel}
        className="absolute inset-y-0 right-0 flex w-14 cursor-pointer items-center justify-center rounded-r-full text-text-muted transition-colors hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text"
        onClick={() => {
          setIsVisible((visible) => !visible)
        }}
        type="button"
      >
        <Icon name={isVisible ? 'view-off' : 'view'} />
      </button>
    </div>
  )
}

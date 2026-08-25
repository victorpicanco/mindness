'use client'

import { forwardRef, type ComponentPropsWithoutRef, useState } from 'react'

import { Icon } from '@/components/ui/icon'
import { Input } from '@/components/ui/input'

type PasswordInputProps = Omit<ComponentPropsWithoutRef<'input'>, 'type'> & {
  readonly hidePasswordLabel: string
  readonly showPasswordLabel: string
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput({ className, hidePasswordLabel, showPasswordLabel, ...props }, ref) {
    const [isVisible, setIsVisible] = useState(false)
    const inputClassName = className === undefined ? 'pr-14' : `${className} pr-14`
    const toggleLabel = isVisible ? hidePasswordLabel : showPasswordLabel

    return (
      <div className="relative">
        <Input
          {...props}
          className={inputClassName}
          ref={ref}
          type={isVisible ? 'text' : 'password'}
        />
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
  },
)

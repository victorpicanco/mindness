import { forwardRef, type ComponentPropsWithoutRef } from 'react'

export type InputProps = ComponentPropsWithoutRef<'input'>

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, ...props },
  ref,
) {
  const classes =
    className === undefined
      ? 'w-full rounded-full border border-transparent bg-input px-6 py-4 font-sans text-base text-text outline-none placeholder:text-text-muted focus-visible:ring-2 focus-visible:ring-text'
      : `w-full rounded-full border border-transparent bg-input px-6 py-4 font-sans text-base text-text outline-none placeholder:text-text-muted focus-visible:ring-2 focus-visible:ring-text ${className}`

  return <input className={classes} ref={ref} {...props} />
})

import type { ComponentPropsWithoutRef, ElementType } from 'react'

type VisuallyHiddenProps<T extends ElementType = 'span'> = {
  as?: T
} & Omit<ComponentPropsWithoutRef<T>, 'as'>

export function VisuallyHidden<T extends ElementType = 'span'>({
  as,
  className,
  ...props
}: VisuallyHiddenProps<T>) {
  const Component = as ?? 'span'
  const classes = className === undefined ? 'sr-only' : `sr-only ${className}`

  return <Component className={classes} {...props} />
}

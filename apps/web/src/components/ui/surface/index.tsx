import type { ComponentPropsWithoutRef } from 'react'

type SurfaceProps = ComponentPropsWithoutRef<'div'>

export function Surface({ className, ...props }: SurfaceProps) {
  const classes =
    className === undefined
      ? 'rounded-control border border-border bg-surface-raised p-4 text-text'
      : `rounded-control border border-border bg-surface-raised p-4 text-text ${className}`

  return <div className={classes} {...props} />
}

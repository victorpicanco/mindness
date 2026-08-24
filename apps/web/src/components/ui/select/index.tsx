import { forwardRef, type ComponentPropsWithoutRef } from 'react'

export type SelectProps = ComponentPropsWithoutRef<'select'>

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, ...props },
  ref,
) {
  const classes =
    className === undefined
      ? 'w-full cursor-pointer appearance-none rounded-full border border-transparent bg-input px-6 py-4 pr-12 font-sans text-base text-text outline-none focus-visible:ring-2 focus-visible:ring-text'
      : `w-full cursor-pointer appearance-none rounded-full border border-transparent bg-input px-6 py-4 pr-12 font-sans text-base text-text outline-none focus-visible:ring-2 focus-visible:ring-text ${className}`

  return (
    <span className="relative block w-full">
      <select className={classes} ref={ref} {...props} />
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-5 size-4 -translate-y-1/2 text-text-muted"
        fill="none"
        viewBox="0 0 16 16"
      >
        <path
          d="m4 6 4 4 4-4"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
      </svg>
    </span>
  )
})

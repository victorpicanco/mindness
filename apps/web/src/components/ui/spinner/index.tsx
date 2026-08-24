import { VisuallyHidden } from '@/components/ui/visually-hidden'

type SpinnerProps = {
  label?: string
}

export function Spinner({ label = 'Loading' }: SpinnerProps) {
  return (
    <span
      aria-label={label}
      className="inline-block size-5 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent"
      role="status"
    >
      <VisuallyHidden>{label}</VisuallyHidden>
    </span>
  )
}

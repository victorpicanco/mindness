type SessionQuotaProps = {
  readonly label: string
  readonly value: string
}

export function SessionQuota({ label, value }: SessionQuotaProps) {
  return (
    <output
      aria-label={label}
      aria-live="polite"
      className="inline-flex min-h-10 items-center rounded-control border border-border bg-surface-raised px-4 text-sm font-medium tabular-nums text-text shadow-[0_1px_0_rgb(0_0_0_/_0.03)]"
    >
      {value}
    </output>
  )
}

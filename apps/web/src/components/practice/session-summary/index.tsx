type SessionSummaryState = 'in_progress' | 'expired' | 'processing' | 'completed' | 'failed'

type SessionSummaryProps = {
  readonly categorySlug: string
  readonly localDate: string
  readonly localTime: string
  readonly state: SessionSummaryState
  readonly stateLabel: string
  readonly totalScore: number | null
  readonly totalScoreLabel: string
}

export function SessionSummary({
  categorySlug,
  localDate,
  localTime,
  state,
  stateLabel,
  totalScore,
  totalScoreLabel,
}: SessionSummaryProps) {
  return (
    <section className="text-center" data-session-state={state}>
      <p className="text-text-muted">{stateLabel}</p>
      <h1 className="font-(family-name:--font-buenard) mt-2 text-3xl leading-tight tracking-tight sm:text-4xl">
        {categorySlug}
      </h1>
      <p className="mt-3 text-text-muted">
        {localDate} · {localTime}
      </p>
      {totalScore === null ? null : (
        <p className="mt-8 text-5xl tabular-nums" title={totalScoreLabel}>
          {totalScore}
        </p>
      )}
    </section>
  )
}

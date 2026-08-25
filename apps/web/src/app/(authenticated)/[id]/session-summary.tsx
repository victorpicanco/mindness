'use client'

import { useTranslations } from 'next-intl'

export type SessionSummaryState = 'in_progress' | 'expired' | 'processing' | 'completed' | 'failed'

interface SessionSummaryProps {
  readonly categorySlug: string
  readonly localDate: string
  readonly localTime: string
  readonly state: SessionSummaryState
  readonly totalScore: number | null
}

export function SessionSummary({
  categorySlug,
  localDate,
  localTime,
  state,
  totalScore,
}: SessionSummaryProps) {
  const t = useTranslations('home.session')

  return (
    <section aria-labelledby="session-title" className="text-center">
      <p className="text-text-muted">{t(`states.${state}`)}</p>
      <h1
        className="font-(family-name:--font-buenard) mt-2 text-3xl leading-tight tracking-tight sm:text-4xl"
        id="session-title"
      >
        {categorySlug}
      </h1>
      <p className="mt-3 text-text-muted">
        {localDate} · {localTime}
      </p>
      {totalScore === null ? null : (
        <p className="mt-8 text-5xl tabular-nums" title={t('totalScore')}>
          {totalScore}
        </p>
      )}
    </section>
  )
}

'use client'

import { useTranslations } from 'next-intl'
import { useId } from 'react'

import { formatCountdown } from '@/components/practice/countdown'

interface ThemeCountdownProps {
  readonly seconds: number
  readonly themeTitle: string
}

export function ThemeCountdown({ seconds, themeTitle }: ThemeCountdownProps) {
  const t = useTranslations('home.research')
  const themeId = useId()

  return (
    <section aria-labelledby={themeId} className="mt-2">
      <h1
        className="font-(family-name:--font-buenard) text-2xl leading-tight tracking-tight sm:text-3xl"
        id={themeId}
      >
        {themeTitle}
      </h1>
      <div className="mt-4 flex items-center justify-between gap-4 rounded-2xl border border-border bg-surface px-4 py-3">
        <span className="text-sm text-text-muted">{t('eyebrow')}</span>
        <p aria-live="polite" className="text-2xl font-medium tabular-nums" role="timer">
          {formatCountdown(seconds)}
        </p>
      </div>
    </section>
  )
}

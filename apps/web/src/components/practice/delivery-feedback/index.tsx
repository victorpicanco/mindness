'use client'

import { useFormatter, useTranslations } from 'next-intl'
import { useId, type ReactNode } from 'react'
import type { z } from 'zod'

import type { sessionAnalysisSchema } from '@/lib/api/contracts/sessions'
import { useAnalysisPlayback } from '@/components/practice/analysis-playback'
import { formatCountdown } from '@/components/practice/countdown'
import { Icon } from '@/components/ui/icon'

type Delivery = NonNullable<z.output<typeof sessionAnalysisSchema>['feedback']['delivery']>

function MomentButton({ startSeconds }: { readonly startSeconds: number }) {
  const playback = useAnalysisPlayback()
  const t = useTranslations('home.analysis.delivery')
  const time = formatCountdown(Math.floor(startSeconds))
  const isPlaying = playback?.playingFrom === startSeconds

  return (
    <button
      aria-label={isPlaying ? t('pauseExcerpt', { time }) : t('listen', { time })}
      className="inline-flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-full py-1 pr-3 pl-1 text-sm tabular-nums text-text-muted transition-colors hover:bg-input hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:bg-transparent disabled:hover:text-text-muted"
      data-excerpt-state={isPlaying ? 'playing' : 'paused'}
      disabled={!playback?.available}
      onClick={() => {
        if (isPlaying) playback?.pause()
        else playback?.playFrom(startSeconds)
      }}
      type="button"
    >
      <span className="grid size-8 place-items-center rounded-full bg-text text-surface">
        <Icon className="text-base" name={isPlaying ? 'pause' : 'play'} />
      </span>
      {time}
    </button>
  )
}

function Disclosure({ children, title }: { readonly children: ReactNode; readonly title: string }) {
  return (
    <details className="group mt-4 border-t border-divider">
      <summary className="flex h-11 cursor-pointer list-none items-center justify-between gap-3 text-sm text-text-muted transition-colors hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text [&::-webkit-details-marker]:hidden">
        {title}
        <Icon
          className="text-base transition-transform duration-200 ease-out group-open:rotate-90"
          name="arrow-right-01"
        />
      </summary>
      <div className="pb-4">{children}</div>
    </details>
  )
}

export function DeliveryFeedback({ delivery }: { readonly delivery: Delivery }) {
  const t = useTranslations('home.analysis.delivery')
  const format = useFormatter()
  const id = useId()
  const { metrics, fillers, nextPractice } = delivery

  return (
    <div className="mt-8 space-y-8">
      {nextPractice === null ? null : (
        <section
          aria-labelledby={`${id}-practice`}
          className="rounded-2xl border border-divider bg-surface-raised p-5 sm:p-6"
        >
          <h3 id={`${id}-practice`} className="text-sm text-text-muted">
            {t('practiceTitle')}
          </h3>
          <p className="mt-2 font-(family-name:--font-buenard) text-2xl leading-tight">
            {nextPractice.focus}
          </p>
          <p className="mt-3 whitespace-pre-wrap leading-7">{nextPractice.exercise}</p>
          <p className="mt-5 text-sm text-text-muted">{t('successLabel')}</p>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-6">
            {nextPractice.successCriterion}
          </p>
        </section>
      )}

      <section aria-labelledby={`${id}-rhythm`}>
        <h3 id={`${id}-rhythm`} className="text-xl font-medium">
          {t('rhythmTitle')}
        </h3>
        <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="font-(family-name:--font-buenard) text-4xl tabular-nums">
            {metrics.wordsPerMinute === null
              ? t('rateUnavailable')
              : format.number(metrics.wordsPerMinute)}
          </span>
          {metrics.wordsPerMinute === null ? null : (
            <span className="text-sm text-text-muted">{t('rateUnit')}</span>
          )}
        </div>
        <p className="mt-2 text-sm text-text-muted">
          {t('wordCount', { count: metrics.wordCount })} ·{' '}
          {t('duration', {
            seconds: format.number(metrics.durationSeconds, { maximumFractionDigits: 1 }),
          })}
        </p>
        <p className="mt-3 text-sm leading-6 text-text-muted">{t('rateNote')}</p>
        {metrics.windows.length === 0 ? null : (
          <Disclosure title={t('windowsTitle')}>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
              {metrics.windows.map((window) => (
                <div key={window.startSeconds} className="border-t border-divider pt-2">
                  <dt className="text-xs tabular-nums text-text-muted">
                    {formatCountdown(window.startSeconds)}–
                    {formatCountdown(Math.ceil(window.endSeconds))}
                  </dt>
                  <dd className="mt-1 text-sm tabular-nums">
                    {t('windowRate', { rate: window.wordsPerMinute })}
                  </dd>
                </div>
              ))}
            </dl>
          </Disclosure>
        )}
      </section>

      <section aria-labelledby={`${id}-fillers`}>
        <h3 id={`${id}-fillers`} className="text-xl font-medium">
          {t('fillersTitle')}
        </h3>
        <p className="mt-4 text-lg">
          {fillers.total === null
            ? t('unavailableCount')
            : t('fillerTotal', { count: fillers.total })}
        </p>
        {fillers.status === 'partial' ? (
          <p className="mt-1 text-sm text-text-muted">{t('partialCount')}</p>
        ) : null}
        {fillers.perMinute === null ? null : (
          <p className="mt-1 text-sm text-text-muted">
            {t('fillerRate', {
              rate: format.number(fillers.perMinute, { maximumFractionDigits: 1 }),
            })}
          </p>
        )}
        <p className="mt-3 text-sm leading-6 text-text-muted">{t('fillersNote')}</p>
        {fillers.byExpression.length === 0 ? null : (
          <ul className="mt-4 flex flex-wrap gap-2">
            {fillers.byExpression.map((item) => (
              <li
                key={item.expression}
                className="rounded-full border border-divider px-3 py-1 text-sm text-text-muted"
              >
                {t('fillerGroup', { expression: item.expression, count: item.count })}
              </li>
            ))}
          </ul>
        )}
        {fillers.occurrences.length === 0 ? null : (
          <Disclosure title={t('occurrencesTitle')}>
            <p className="text-xs text-text-muted">{t('timestampNote')}</p>
            <ol className="mt-2 divide-y divide-divider border-t border-divider">
              {fillers.occurrences.map((item) => (
                <li
                  key={`${item.startSeconds}-${item.endSeconds}`}
                  className="flex flex-col gap-1 py-2 sm:flex-row sm:items-center sm:gap-4"
                >
                  <MomentButton startSeconds={item.startSeconds} />
                  <div className="min-w-0">
                    <p className="whitespace-pre-wrap break-words text-sm leading-6 text-text-muted">
                      “{item.quote}”
                    </p>
                    {item.confidence === 'medium' ? (
                      <p className="text-xs text-text-muted">{t('mediumConfidence')}</p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          </Disclosure>
        )}
      </section>

      {delivery.moments.length === 0 ? null : (
        <section aria-labelledby={`${id}-moments`}>
          <h3 id={`${id}-moments`} className="text-xl font-medium">
            {t('momentsTitle')}
          </h3>
          <p className="mt-2 text-xs text-text-muted">{t('timestampNote')}</p>
          <ol className="mt-4 divide-y divide-divider border-t border-divider">
            {delivery.moments.map((moment) => (
              <li
                key={`${moment.kind}-${moment.startSeconds}-${moment.endSeconds}`}
                className="py-5"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <MomentButton startSeconds={moment.startSeconds} />
                  <span className="text-sm text-text-muted">{t(`kinds.${moment.kind}`)}</span>
                </div>
                <blockquote className="mt-3 whitespace-pre-wrap break-words leading-7">
                  “{moment.quote}”
                </blockquote>
                <p className="mt-2 whitespace-pre-wrap leading-7 text-text-muted">
                  {moment.observation}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-text-muted">
                  {moment.impact}
                </p>
                <p className="mt-3 whitespace-pre-wrap leading-7">{moment.action}</p>
              </li>
            ))}
          </ol>
        </section>
      )}

      {delivery.limitations.length === 0 ? null : (
        <section aria-labelledby={`${id}-limitations`}>
          <h3 id={`${id}-limitations`} className="text-sm text-text-muted">
            {t('limitationsTitle')}
          </h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-text-muted">
            {delivery.limitations.map((limitation) => (
              <li key={limitation}>{limitation}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

'use client'

import { useTranslations } from 'next-intl'
import type { z } from 'zod'

import type { sessionAnalysisSchema } from '@/lib/api/contracts/sessions'

import { AudioPlayer } from './audio-player'

type SessionAnalysis = z.output<typeof sessionAnalysisSchema>

const SCORE_KEYS = ['total', 'clarity', 'rhythm', 'fluency', 'mastery'] as const

export function Analysis({ analysis }: { readonly analysis: SessionAnalysis }) {
  const t = useTranslations('home.analysis')

  return (
    <article aria-labelledby="analysis-title" className="mx-auto w-full max-w-3xl">
      <h1
        className="font-(family-name:--font-buenard) text-3xl leading-tight tracking-tight sm:text-4xl"
        id="analysis-title"
      >
        {t('title')}
      </h1>

      <section aria-labelledby="scores-title" className="mt-8">
        <h2 className="text-xl font-medium" id="scores-title">
          {t('scoresTitle')}
        </h2>
        <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-5">
          {SCORE_KEYS.map((key) => (
            <div className="rounded-lg border border-border p-4" key={key}>
              <dt className="text-sm text-text-muted">{t(`scoreLabels.${key}`)}</dt>
              <dd className="mt-1 text-2xl tabular-nums">{analysis.scores[key]}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="guidance-title" className="mt-8">
        <h2 className="text-xl font-medium" id="guidance-title">
          {t('guidanceTitle')}
        </h2>
        <ul className="mt-4 space-y-4">
          {analysis.guidance.map((guidance) => (
            <li className="rounded-lg border border-border p-4" key={guidance.pillar}>
              <h3 className="font-medium">{t(`scoreLabels.${guidance.pillar}`)}</h3>
              <p className="mt-2 whitespace-pre-wrap text-text-muted">{guidance.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="recording-title" className="mt-8">
        <h2 className="text-xl font-medium" id="recording-title">
          {t('recordingTitle')}
        </h2>
        <div className="mt-4">
          <AudioPlayer sessionId={analysis.sessionId} />
        </div>
      </section>

      <section aria-labelledby="transcript-title" className="mt-8">
        <h2 className="text-xl font-medium" id="transcript-title">
          {t('transcriptTitle')}
        </h2>
        <p className="mt-4 whitespace-pre-wrap text-text-muted">{analysis.transcript}</p>
      </section>
    </article>
  )
}

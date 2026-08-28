'use client'

import { useTranslations } from 'next-intl'
import type { z } from 'zod'

import type { sessionAnalysisSchema } from '@/lib/api/contracts/sessions'

import { SessionMessage } from '@/components/practice/session-message'
import { SplitText } from '@/components/ui/split-text'

type SessionAnalysis = z.output<typeof sessionAnalysisSchema>

const SCORE_KEYS = ['total', 'clarity', 'rhythm', 'fluency', 'mastery'] as const

interface AnalysisMessageProps {
  readonly analysis: SessionAnalysis
}

export function AnalysisMessage({ analysis }: AnalysisMessageProps) {
  const t = useTranslations('home.analysis')
  const conversationT = useTranslations('home.conversation')

  return (
    <SessionMessage label={conversationT('assistantMessageLabel')} sender="assistant">
      <div aria-labelledby="analysis-title">
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
          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-5">
            {SCORE_KEYS.map((key) => (
              <div key={key}>
                <dt className="text-xs text-text-muted">{t(`scoreLabels.${key}`)}</dt>
                <dd className="mt-1 text-2xl tabular-nums">{analysis.scores[key]}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="guidance-title" className="mt-8">
          <h2 className="text-xl font-medium" id="guidance-title">
            {t('guidanceTitle')}
          </h2>
          <ul className="mt-4 space-y-6">
            {analysis.guidance.map((guidance) => (
              <li key={guidance.pillar}>
                <h3 className="font-medium">{t(`scoreLabels.${guidance.pillar}`)}</h3>
                <SplitText className="mt-1.5 whitespace-pre-wrap leading-7" text={guidance.text} />
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="transcript-title" className="mt-8">
          <h2 className="text-xl font-medium" id="transcript-title">
            {t('transcriptTitle')}
          </h2>
          <SplitText
            className="mt-4 whitespace-pre-wrap leading-7 text-text-muted"
            delay={18}
            text={analysis.transcript}
          />
        </section>
      </div>
    </SessionMessage>
  )
}

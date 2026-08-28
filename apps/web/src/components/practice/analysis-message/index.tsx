'use client'

import { useTranslations } from 'next-intl'
import { useId } from 'react'
import type { z } from 'zod'

import type { sessionAnalysisSchema } from '@/lib/api/contracts/sessions'

import { SessionMessage } from '@/components/practice/session-message'
import { ScoreRadial } from '@/components/ui/score-radial'
import { SplitText } from '@/components/ui/split-text'

type SessionAnalysis = z.output<typeof sessionAnalysisSchema>

const PILLAR_KEYS = ['clarity', 'rhythm', 'fluency', 'mastery'] as const

interface AnalysisMessageProps {
  readonly analysis: SessionAnalysis
}

export function AnalysisMessage({ analysis }: AnalysisMessageProps) {
  const t = useTranslations('home.analysis')
  const conversationT = useTranslations('home.conversation')
  const titleId = useId()
  const scoresId = useId()
  const guidanceId = useId()
  const transcriptId = useId()

  return (
    <SessionMessage label={conversationT('assistantMessageLabel')} sender="assistant">
      <div aria-labelledby={titleId}>
        <h2
          className="font-(family-name:--font-buenard) text-3xl leading-tight tracking-tight sm:text-4xl"
          id={titleId}
        >
          {t('title')}
        </h2>

        <section aria-labelledby={scoresId} className="mt-8">
          <h3 className="text-xl font-medium" id={scoresId}>
            {t('scoresTitle')}
          </h3>
          <dl className="mt-6 flex flex-col items-center gap-10 sm:flex-row sm:gap-12">
            <div className="flex flex-col-reverse items-center gap-3">
              <dt className="text-sm text-text-muted">{t('scoreLabels.total')}</dt>
              <dd>
                <ScoreRadial size="lg" value={analysis.scores.total} />
              </dd>
            </div>
            <div className="grid w-full grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-4">
              {PILLAR_KEYS.map((key) => (
                <div className="flex flex-col-reverse items-center gap-2.5" key={key}>
                  <dt className="text-xs text-text-muted">{t(`scoreLabels.${key}`)}</dt>
                  <dd>
                    <ScoreRadial value={analysis.scores[key]} />
                  </dd>
                </div>
              ))}
            </div>
          </dl>
        </section>

        <section aria-labelledby={guidanceId} className="mt-8">
          <h3 className="text-xl font-medium" id={guidanceId}>
            {t('guidanceTitle')}
          </h3>
          <ul className="mt-4 space-y-6">
            {analysis.guidance.map((guidance) => (
              <li key={guidance.pillar}>
                <h4 className="font-medium">{t(`scoreLabels.${guidance.pillar}`)}</h4>
                <SplitText className="mt-1.5 whitespace-pre-wrap leading-7" text={guidance.text} />
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby={transcriptId} className="mt-8">
          <h3 className="text-xl font-medium" id={transcriptId}>
            {t('transcriptTitle')}
          </h3>
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

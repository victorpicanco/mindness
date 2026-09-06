'use client'

import { useTranslations } from 'next-intl'
import { useId } from 'react'
import type { z } from 'zod'

import { DeliveryFeedback } from '@/components/practice/delivery-feedback'
import { SessionMessage } from '@/components/practice/session-message'
import { SplitText } from '@/components/ui/split-text'
import type { sessionAnalysisSchema } from '@/lib/api/contracts/sessions'

type SessionAnalysis = z.output<typeof sessionAnalysisSchema>

interface AnalysisMessageProps {
  readonly analysis: SessionAnalysis
}

export function AnalysisMessage({ analysis }: AnalysisMessageProps) {
  const t = useTranslations('home.analysis')
  const conversationT = useTranslations('home.conversation')
  const titleId = useId()
  const summaryId = useId()
  const strengthsId = useId()
  const improvementsId = useId()
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

        <section aria-labelledby={summaryId} className="mt-8">
          <h3 className="text-xl font-medium" id={summaryId}>
            {t('summaryTitle')}
          </h3>
          <SplitText
            className="mt-4 whitespace-pre-wrap leading-7"
            text={analysis.feedback.summary}
          />
        </section>

        {analysis.feedback.delivery === undefined ? null : (
          <DeliveryFeedback delivery={analysis.feedback.delivery} />
        )}

        {analysis.feedback.strengths.length > 0 && (
          <section aria-labelledby={strengthsId} className="mt-8">
            <h3 className="text-xl font-medium" id={strengthsId}>
              {t('strengthsTitle')}
            </h3>
            <ul className="mt-4 space-y-6">
              {analysis.feedback.strengths.map((strength) => (
                <li key={strength.title}>
                  <h4 className="font-medium">{strength.title}</h4>
                  <SplitText
                    className="mt-1.5 whitespace-pre-wrap leading-7 text-text-muted"
                    text={strength.evidence}
                  />
                </li>
              ))}
            </ul>
          </section>
        )}

        {analysis.feedback.improvements.length > 0 && (
          <section aria-labelledby={improvementsId} className="mt-8">
            <h3 className="text-xl font-medium" id={improvementsId}>
              {t('improvementsTitle')}
            </h3>
            <ul className="mt-4 space-y-6">
              {analysis.feedback.improvements.map((improvement) => (
                <li key={improvement.title}>
                  <h4 className="font-medium">{improvement.title}</h4>
                  <p className="mt-1.5 text-sm font-medium text-text-muted">{t('evidenceLabel')}</p>
                  <SplitText
                    className="mt-1 whitespace-pre-wrap leading-7 text-text-muted"
                    text={improvement.evidence}
                  />
                  <p className="mt-3 text-sm font-medium text-text-muted">{t('actionLabel')}</p>
                  <SplitText
                    className="mt-1 whitespace-pre-wrap leading-7"
                    text={improvement.action}
                  />
                </li>
              ))}
            </ul>
          </section>
        )}

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

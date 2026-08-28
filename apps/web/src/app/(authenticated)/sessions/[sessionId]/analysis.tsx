'use client'

import { useTranslations } from 'next-intl'
import type { z } from 'zod'

import type { sessionAnalysisSchema } from '@/lib/api/contracts/sessions'
import type { SessionHistoryItem } from '@/lib/api/contracts/sessions'
import { usePracticeSessionStore } from '@/stores/practice-session/provider'

import { AnalysisMessage } from '@/components/practice/analysis-message'
import { SessionConversation } from '@/components/practice/session-conversation'
import { SessionMessage } from '@/components/practice/session-message'

import { AudioPlayer } from './audio-player'

type SessionAnalysis = z.output<typeof sessionAnalysisSchema>

interface AnalysisProps {
  readonly analysis: SessionAnalysis
  readonly session?: SessionHistoryItem
}

export function Analysis({ analysis, session }: AnalysisProps) {
  const practiceSession = usePracticeSessionStore((state) => state.session)
  const status = usePracticeSessionStore((state) => state.status)

  if (status === 'done' && practiceSession?.sessionId === analysis.sessionId) {
    return <SessionConversation analysis={analysis} />
  }

  return <PastSessionAnalysis analysis={analysis} {...(session === undefined ? {} : { session })} />
}

function PastSessionAnalysis({ analysis, session }: AnalysisProps) {
  const conversationT = useTranslations('home.conversation')

  return (
    <section
      aria-label={conversationT('label')}
      className="min-h-0 flex-1 overflow-y-auto px-4 py-8 sm:px-8"
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        {session === undefined ? null : (
          <>
            <SessionMessage label={conversationT('userMessageLabel')} sender="user">
              <p>
                {conversationT('completedConfiguration', {
                  category: session.categorySlug,
                  difficulty: conversationT(`difficulties.${session.difficulty}`),
                })}
              </p>
            </SessionMessage>

            <SessionMessage label={conversationT('assistantMessageLabel')} sender="assistant">
              <p>
                {conversationT('completedTheme', {
                  theme: session.themeTitle ?? session.categorySlug,
                })}
              </p>
            </SessionMessage>
          </>
        )}

        <AudioPlayer label={conversationT('userMessageLabel')} sessionId={analysis.sessionId} />

        <AnalysisMessage analysis={analysis} />
      </div>
    </section>
  )
}

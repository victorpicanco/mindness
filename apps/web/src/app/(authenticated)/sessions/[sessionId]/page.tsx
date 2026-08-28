import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'

import { sessionAnalysisSchema } from '@/lib/api/contracts/sessions'
import { getActiveSession, getSessionHistory } from '@/lib/api/authenticated-session-data'
import { ApiClientError } from '@/lib/api/client-error'
import { apiFetch } from '@/lib/api/server-client'

import { SessionConversation } from '@/components/practice/session-conversation'
import { SessionSummary } from '@/components/practice/session-summary'

import { Analysis } from './analysis'

interface SessionPageProps {
  readonly params: Promise<{ readonly sessionId: string }>
}

type SessionAnalysis = ReturnType<typeof sessionAnalysisSchema.parse>

async function readAnalysis(sessionId: string): Promise<SessionAnalysis> {
  try {
    return await apiFetch(`/sessions/${sessionId}/analysis`, {
      cache: 'no-store',
      schema: sessionAnalysisSchema,
    })
  } catch (cause: unknown) {
    if (cause instanceof ApiClientError && cause.code === 'analyses.ANALYSIS_NOT_FOUND') {
      notFound()
    }

    throw cause
  }
}

export default async function SessionPage({ params }: SessionPageProps) {
  const [{ sessionId }, activeSession, history, t] = await Promise.all([
    params,
    getActiveSession(),
    getSessionHistory(),
    getTranslations('home.session'),
  ])

  if (activeSession !== null && activeSession.sessionId === sessionId) {
    return (
      <div className="flex min-h-0 flex-1 flex-col bg-surface">
        <SessionConversation />
      </div>
    )
  }

  const session = history.data.find((candidate) => candidate.sessionId === sessionId)

  if (session === undefined || session.state === 'completed') {
    return (
      <div className="flex min-h-0 flex-1 flex-col bg-surface">
        <Analysis analysis={await readAnalysis(sessionId)} session={session} />
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-surface px-6 py-10">
      <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 items-center justify-center">
        <SessionSummary
          categorySlug={session.categorySlug}
          localDate={session.localDate}
          localTime={session.localTime}
          state={session.state}
          stateLabel={t(`states.${session.state}`)}
          totalScore={session.totalScore}
          totalScoreLabel={t('totalScore')}
        />
      </div>
    </div>
  )
}

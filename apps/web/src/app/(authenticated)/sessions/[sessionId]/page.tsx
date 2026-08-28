import { notFound } from 'next/navigation'

import {
  activeSessionSchema,
  sessionAnalysisSchema,
  sessionHistorySchema,
} from '@/lib/api/contracts/sessions'
import { ApiClientError } from '@/lib/api/client-error'
import { apiFetch } from '@/lib/api/server-client'

import { ProcessingStatus } from '@/components/practice/processing-status'
import { RecordingStart } from '@/components/practice/recording-start'
import { ResearchTimer } from '@/components/practice/research-timer'
import { SessionSummary } from '@/components/practice/session-summary'

import { Analysis } from './analysis'

type ApiFetch = typeof apiFetch
type NotFound = typeof notFound

interface SessionPageProps {
  readonly params: Promise<{ readonly sessionId: string }>
}

type SessionAnalysis = ReturnType<typeof sessionAnalysisSchema.parse>

async function readAnalysis(
  fetchFromApi: ApiFetch,
  sessionId: string,
  renderNotFound: NotFound,
): Promise<SessionAnalysis> {
  try {
    return await fetchFromApi(`/sessions/${sessionId}/analysis`, {
      cache: 'no-store',
      schema: sessionAnalysisSchema,
    })
  } catch (cause: unknown) {
    if (cause instanceof ApiClientError && cause.code === 'analyses.ANALYSIS_NOT_FOUND') {
      renderNotFound()
    }

    throw cause
  }
}

export function createSessionPage(fetchFromApi: ApiFetch, renderNotFound: NotFound = notFound) {
  return async function SessionPage({ params }: SessionPageProps) {
    const [{ sessionId }, activeSession, sessions] = await Promise.all([
      params,
      fetchFromApi('/sessions/active', { cache: 'no-store', schema: activeSessionSchema }),
      fetchFromApi('/sessions', { cache: 'no-store', schema: sessionHistorySchema }),
    ])

    if (activeSession === null || activeSession.sessionId !== sessionId) {
      const session = sessions.find((candidate) => candidate.sessionId === sessionId)

      if (session === undefined || session.state === 'completed') {
        const analysis = await readAnalysis(fetchFromApi, sessionId, renderNotFound)

        return (
          <div className="flex min-h-0 flex-1 flex-col bg-surface px-6 py-10">
            <Analysis analysis={analysis} />
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
              totalScore={session.totalScore}
            />
          </div>
        </div>
      )
    }

    return (
      <div className="flex min-h-0 flex-1 flex-col bg-surface px-6 py-10">
        <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col">
          <ResearchTimer />
          <RecordingStart />
          <ProcessingStatus />
        </div>
      </div>
    )
  }
}

const SessionPage = createSessionPage(apiFetch)

export default SessionPage

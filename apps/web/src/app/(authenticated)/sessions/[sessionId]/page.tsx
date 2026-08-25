import { notFound } from 'next/navigation'

import { activeSessionSchema, sessionHistorySchema } from '@/lib/api/contracts/sessions'
import { apiFetch } from '@/lib/api/server-client'
import { PracticeSessionProvider } from '@/stores/practice-session/provider'

import { RecordingStart } from '@/components/practice/recording-start'
import { ResearchTimer } from '@/components/practice/research-timer'
import { SessionSummary } from '@/components/practice/session-summary'

type ApiFetch = typeof apiFetch
type NotFound = typeof notFound

interface SessionPageProps {
  readonly params: Promise<{ readonly sessionId: string }>
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

      if (session === undefined) renderNotFound()

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

    const isResearchOver = new Date(activeSession.researchEndsAt).getTime() <= Date.now()

    return (
      <PracticeSessionProvider
        initialState={{
          session: {
            expiresAt: activeSession.expiresAt,
            researchEndsAt: activeSession.researchEndsAt,
            sessionId: activeSession.sessionId,
            themeTitle: activeSession.themeTitle,
          },
          status: isResearchOver ? 'awaiting-recording' : 'researching',
        }}
      >
        <div className="flex min-h-0 flex-1 flex-col bg-surface px-6 py-10">
          <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col">
            <ResearchTimer />
            <RecordingStart />
          </div>
        </div>
      </PracticeSessionProvider>
    )
  }
}

const SessionPage = createSessionPage(apiFetch)

export default SessionPage

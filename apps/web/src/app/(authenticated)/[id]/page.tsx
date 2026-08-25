import { notFound } from 'next/navigation'
import { z } from 'zod'

import { apiFetch } from '@/lib/api/server-client'
import { PracticeSessionProvider } from '@/stores/practice-session/provider'

import { RecordingStart } from '../recording-start'
import { ResearchTimer } from '../research-timer'
import { SessionSummary } from './session-summary'

const activeSessionSchema = z
  .object({
    configuration: z.object({
      categorySlug: z.string(),
      difficulty: z.enum(['easy', 'balanced', 'hard']),
      searchWindowMinutes: z.union([z.literal(3), z.literal(4), z.literal(5)]),
    }),
    createdAt: z.iso.datetime(),
    expiresAt: z.iso.datetime(),
    recordingStartedAt: z.iso.datetime().nullable(),
    researchEndsAt: z.iso.datetime(),
    sessionId: z.uuid(),
    themeId: z.uuid(),
    themeTitle: z.string(),
  })
  .nullable()

const sessionHistorySchema = z.array(
  z.object({
    bestOfDay: z.boolean(),
    categorySlug: z.string(),
    difficulty: z.enum(['easy', 'balanced', 'hard']),
    localDate: z.string(),
    localTime: z.string(),
    sessionId: z.uuid(),
    startedAt: z.iso.datetime(),
    state: z.enum(['in_progress', 'expired', 'processing', 'completed', 'failed']),
    totalScore: z.number().int().min(0).max(100).nullable(),
  }),
)

type ApiFetch = typeof apiFetch
type NotFound = typeof notFound

interface SessionPageProps {
  readonly params: Promise<{ readonly id: string }>
}

export function createSessionPage(fetchFromApi: ApiFetch, renderNotFound: NotFound = notFound) {
  return async function SessionPage({ params }: SessionPageProps) {
    const [{ id }, activeSession, sessions] = await Promise.all([
      params,
      fetchFromApi('/sessions/active', { cache: 'no-store', schema: activeSessionSchema }),
      fetchFromApi('/sessions', { cache: 'no-store', schema: sessionHistorySchema }),
    ])

    if (activeSession === null || activeSession.sessionId !== id) {
      const session = sessions.find((candidate) => candidate.sessionId === id)

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
          <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 items-center justify-center">
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

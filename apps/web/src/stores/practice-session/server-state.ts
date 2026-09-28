import type { activeSessionSchema } from '@/lib/api/contracts/sessions'
import type { PracticeSessionInitialState } from './store'

type ActiveSession = NonNullable<ReturnType<typeof activeSessionSchema.parse>>

export function practiceSessionInitialState(
  activeSession: ActiveSession,
): PracticeSessionInitialState {
  const isResearchOver =
    new Date(activeSession.researchEndsAt).getTime() <= new Date(activeSession.serverNow).getTime()

  return {
    serverTimeOffsetMs: new Date(activeSession.serverNow).getTime() - Date.now(),
    session: {
      configuration: activeSession.configuration,
      createdAt: activeSession.createdAt,
      expiresAt: activeSession.expiresAt,
      recordingStartedAt: activeSession.recordingStartedAt,
      researchEndsAt: activeSession.researchEndsAt,
      sessionId: activeSession.sessionId,
      themeTitle: activeSession.themeTitle,
    },
    status:
      activeSession.recordingStartedAt !== null
        ? 'expired'
        : isResearchOver
          ? 'awaiting-recording'
          : 'researching',
  }
}

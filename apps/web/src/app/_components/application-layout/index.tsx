import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'

import { AuthenticatedSessionShell } from '@/app/_components/session-shell'
import type { activeSessionSchema } from '@/lib/api/contracts/sessions'
import {
  getAccountProfileIfAuthenticated,
  getActiveSessionIfAuthenticated,
  getSessionHistory,
} from '@/lib/api/authenticated-session-data'
import { createRequireSession } from '@/lib/auth/require-session'
import { signOutAction } from '@/lib/auth/sign-out'
import { signInAction, signUpAction } from '@/lib/auth/authentication-actions'
import { hasUsedGuestTrial } from '@/lib/auth/guest-trial'
import { groupSessionsByDay } from '@/lib/sessions/session-day-groups'
import type { PracticeSessionInitialState } from '@/stores/practice-session/store'

const SIDEBAR_PREFERENCE_COOKIE_NAME = 'mindness-sidebar-expanded'

interface ApplicationLayoutProps {
  readonly children: ReactNode
  readonly requireAuthentication: boolean
}

function practiceSessionInitialState(
  activeSession: ReturnType<typeof activeSessionSchema.parse>,
): PracticeSessionInitialState | undefined {
  if (activeSession === null) return undefined

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

export async function ApplicationLayout({
  children,
  requireAuthentication,
}: ApplicationLayoutProps) {
  const cookieStore = await cookies()

  if (requireAuthentication) createRequireSession({ cookieStore, redirect })()

  const accountProfile = await getAccountProfileIfAuthenticated()
  const [activeSession, history] = await Promise.all([
    accountProfile === null ? null : getActiveSessionIfAuthenticated(),
    accountProfile?.accountKind === 'registered' ? getSessionHistory() : null,
  ])
  const isSidebarExpanded = cookieStore.get(SIDEBAR_PREFERENCE_COOKIE_NAME)?.value !== 'false'
  const sessionGroups =
    history === null
      ? []
      : groupSessionsByDay({
          now: new Date(),
          sessions: history.data,
          timeZone: history.meta.timeZone,
        })

  return (
    <AuthenticatedSessionShell
      activeSessionId={activeSession?.sessionId}
      initialPracticeSessionState={practiceSessionInitialState(activeSession)}
      initialIsExpanded={isSidebarExpanded}
      isTrialConsumed={hasUsedGuestTrial(cookieStore)}
      preferenceCookieName={SIDEBAR_PREFERENCE_COOKIE_NAME}
      sessionGroups={sessionGroups}
      signInAction={signInAction}
      signOut={signOutAction}
      signUpAction={signUpAction}
      viewer={accountProfile ?? { accountKind: 'visitor' }}
    >
      {children}
    </AuthenticatedSessionShell>
  )
}

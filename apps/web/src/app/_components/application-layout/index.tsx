import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'

import { AuthenticatedSessionShell } from '@/app/_components/session-shell'
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
import { practiceSessionInitialState } from '@/stores/practice-session/server-state'

const SIDEBAR_PREFERENCE_COOKIE_NAME = 'mindness-sidebar-expanded'

interface ApplicationLayoutProps {
  readonly children: ReactNode
  readonly requireAuthentication: boolean
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
      initialPracticeSessionState={
        activeSession === null ? undefined : practiceSessionInitialState(activeSession)
      }
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

import { cookies } from 'next/headers'
import { NextIntlClientProvider } from 'next-intl'
import { redirect } from 'next/navigation'
import { Suspense, type ReactNode } from 'react'

import { authenticatedClientMessages } from '@/i18n/client-messages'
import { RouteLoading } from '@/components/layouts/route-loading'
import type { activeSessionSchema } from '@/lib/api/contracts/sessions'
import { getActiveSession, getSessionHistory } from '@/lib/api/authenticated-session-data'
import { createRequireSession } from '@/lib/auth/require-session'
import { signOutAction } from '@/lib/auth/sign-out'
import { groupSessionsByDay } from '@/lib/sessions/session-day-groups'
import type { PracticeSessionInitialState } from '@/stores/practice-session/store'

import { AuthenticatedSessionShell } from './authenticated-session-shell'

const SIDEBAR_PREFERENCE_COOKIE_NAME = 'mindness-sidebar-expanded'

interface AuthenticatedLayoutProps {
  readonly children: ReactNode
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

async function AuthenticatedLayoutContent({ children }: AuthenticatedLayoutProps) {
  const cookieStore = await cookies()
  createRequireSession({ cookieStore, redirect })()
  const [history, activeSession] = await Promise.all([getSessionHistory(), getActiveSession()])
  const isSidebarExpanded = cookieStore.get(SIDEBAR_PREFERENCE_COOKIE_NAME)?.value !== 'false'
  const initialPracticeSessionState = practiceSessionInitialState(activeSession)

  return (
    <AuthenticatedSessionShell
      activeSessionId={activeSession?.sessionId}
      initialPracticeSessionState={initialPracticeSessionState}
      initialIsExpanded={isSidebarExpanded}
      preferenceCookieName={SIDEBAR_PREFERENCE_COOKIE_NAME}
      sessionGroups={groupSessionsByDay({
        now: new Date(),
        sessions: history.data,
        timeZone: history.meta.timeZone,
      })}
      signOut={signOutAction}
    >
      {children}
    </AuthenticatedSessionShell>
  )
}

export default function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  return (
    <NextIntlClientProvider messages={authenticatedClientMessages}>
      <Suspense fallback={<RouteLoading />}>
        <AuthenticatedLayoutContent>{children}</AuthenticatedLayoutContent>
      </Suspense>
    </NextIntlClientProvider>
  )
}

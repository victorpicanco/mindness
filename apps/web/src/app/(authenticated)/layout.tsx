import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { Suspense, type ReactNode } from 'react'

import { RouteLoading } from '@/components/layouts/route-loading'
import { SessionQuota } from '@/components/layouts/session-quota'
import {
  activeSessionSchema,
  quotaSchema,
  sessionHistoryMetaSchema,
  sessionHistorySchema,
} from '@/lib/api/contracts/sessions'
import { apiFetch, apiFetchWithMeta } from '@/lib/api/server-client'
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
  const [quota, history, activeSession] = await Promise.all([
    apiFetch('/sessions/quota', { cache: 'no-store', schema: quotaSchema }),
    apiFetchWithMeta('/sessions', {
      cache: 'no-store',
      metaSchema: sessionHistoryMetaSchema,
      schema: sessionHistorySchema,
    }),
    apiFetch('/sessions/active', { cache: 'no-store', schema: activeSessionSchema }),
  ])
  const isSidebarExpanded = cookieStore.get(SIDEBAR_PREFERENCE_COOKIE_NAME)?.value !== 'false'
  const initialPracticeSessionState = practiceSessionInitialState(activeSession)

  return (
    <AuthenticatedSessionShell
      {...(initialPracticeSessionState === undefined ? {} : { initialPracticeSessionState })}
      {...(activeSession === null ? {} : { activeSessionId: activeSession.sessionId })}
      initialIsExpanded={isSidebarExpanded}
      preferenceCookieName={SIDEBAR_PREFERENCE_COOKIE_NAME}
      sessionGroups={groupSessionsByDay({
        now: new Date(),
        sessions: history.data,
        timeZone: history.meta.timeZone,
      })}
      signOut={signOutAction}
      {...(!quota.enforced
        ? {}
        : {
            header: (
              <SessionQuota
                allowance={quota.allowance}
                remaining={quota.remaining}
                renewsAt={quota.renewsAt}
              />
            ),
          })}
    >
      {children}
    </AuthenticatedSessionShell>
  )
}

export default function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  return (
    <Suspense fallback={<RouteLoading />}>
      <AuthenticatedLayoutContent>{children}</AuthenticatedLayoutContent>
    </Suspense>
  )
}

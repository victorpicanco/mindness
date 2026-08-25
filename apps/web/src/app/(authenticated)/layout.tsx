import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { Suspense, type ReactNode } from 'react'

import { AuthenticatedShell } from '@/components/layouts/authenticated-shell'
import { RouteLoading } from '@/components/layouts/route-loading'
import { SessionQuota } from '@/components/layouts/session-quota'
import {
  quotaSchema,
  sessionHistoryMetaSchema,
  sessionHistorySchema,
} from '@/lib/api/contracts/sessions'
import { apiFetch, apiFetchWithMeta } from '@/lib/api/server-client'
import { createRequireSession } from '@/lib/auth/require-session'
import { signOutAction } from '@/lib/auth/sign-out'
import { groupSessionsByDay } from '@/lib/sessions/session-day-groups'

const SIDEBAR_PREFERENCE_COOKIE_NAME = 'mindness-sidebar-expanded'

interface AuthenticatedLayoutProps {
  readonly children: ReactNode
}

async function AuthenticatedLayoutContent({ children }: AuthenticatedLayoutProps) {
  const cookieStore = await cookies()
  createRequireSession({ cookieStore, redirect })()
  const [quota, history] = await Promise.all([
    apiFetch('/sessions/quota', { cache: 'no-store', schema: quotaSchema }),
    apiFetchWithMeta('/sessions', {
      cache: 'no-store',
      metaSchema: sessionHistoryMetaSchema,
      schema: sessionHistorySchema,
    }),
  ])
  const isSidebarExpanded = cookieStore.get(SIDEBAR_PREFERENCE_COOKIE_NAME)?.value !== 'false'

  return (
    <AuthenticatedShell
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
    </AuthenticatedShell>
  )
}

export default function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  return (
    <Suspense fallback={<RouteLoading />}>
      <AuthenticatedLayoutContent>{children}</AuthenticatedLayoutContent>
    </Suspense>
  )
}

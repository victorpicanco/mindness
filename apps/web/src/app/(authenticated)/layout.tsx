import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { Suspense, type ReactNode } from 'react'

import { AuthenticatedShell } from '@/components/layouts/authenticated-shell'
import { RouteLoading } from '@/components/layouts/route-loading'
import { SessionQuota } from '@/components/layouts/session-quota'
import type { SidebarNavigationItem } from '@/components/ui/sidebar'
import {
  quotaSchema,
  sessionHistorySchema,
  type SessionHistoryItem,
} from '@/lib/api/contracts/sessions'
import { apiFetch } from '@/lib/api/server-client'
import { createRequireSession } from '@/lib/auth/require-session'
import { signOutAction } from '@/lib/auth/sign-out'
import { sessionPath } from '@/lib/navigation/session-routes'

const SIDEBAR_PREFERENCE_COOKIE_NAME = 'mindness-sidebar-expanded'

export function sessionNavigationItems(
  sessions: readonly SessionHistoryItem[],
): readonly SidebarNavigationItem[] {
  return sessions.map((session) => ({
    href: sessionPath(session.sessionId),
    icon: 'clock-01',
    label: `${session.categorySlug} · ${session.localDate} ${session.localTime}`,
  }))
}

interface AuthenticatedLayoutProps {
  readonly children: ReactNode
}

async function AuthenticatedLayoutContent({ children }: AuthenticatedLayoutProps) {
  const cookieStore = await cookies()
  createRequireSession({ cookieStore, redirect })()
  const [quota, sessions] = await Promise.all([
    apiFetch('/sessions/quota', { cache: 'no-store', schema: quotaSchema }),
    apiFetch('/sessions', { cache: 'no-store', schema: sessionHistorySchema }),
  ])
  const isSidebarExpanded = cookieStore.get(SIDEBAR_PREFERENCE_COOKIE_NAME)?.value !== 'false'

  return (
    <AuthenticatedShell
      initialIsExpanded={isSidebarExpanded}
      preferenceCookieName={SIDEBAR_PREFERENCE_COOKIE_NAME}
      sessionItems={sessionNavigationItems(sessions)}
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

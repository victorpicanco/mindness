import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { z } from 'zod'

import { signOutAction } from '@/app/auth/sign-out/actions'
import { AuthenticatedShell } from '@/components/layouts/authenticated-shell'
import { SessionQuota } from '@/components/layouts/session-quota'
import type { SidebarNavigationItem } from '@/components/ui/sidebar'
import { apiFetch } from '@/lib/api/server-client'
import { createRequireSession } from '@/lib/auth/require-session'
import { sessionPath } from '@/lib/navigation/session-routes'

const SIDEBAR_PREFERENCE_COOKIE_NAME = 'mindness-sidebar-expanded'

const quotaSchema = z.discriminatedUnion('enforced', [
  z.object({
    allowance: z.number().nonnegative(),
    enforced: z.literal(true),
    remaining: z.number().nonnegative(),
    renewsAt: z.iso.datetime(),
  }),
  z.object({ enforced: z.literal(false) }),
])

const sessionHistoryItemSchema = z.object({
  bestOfDay: z.boolean(),
  categorySlug: z.string(),
  difficulty: z.enum(['easy', 'balanced', 'hard']),
  localDate: z.string(),
  localTime: z.string(),
  sessionId: z.uuid(),
  startedAt: z.iso.datetime(),
  state: z.enum(['in_progress', 'expired', 'processing', 'completed', 'failed']),
  totalScore: z.number().int().min(0).max(100).nullable(),
})

const sessionHistorySchema = z.array(sessionHistoryItemSchema)

type SessionHistoryItem = z.output<typeof sessionHistoryItemSchema>

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

export default async function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
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

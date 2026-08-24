import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { z } from 'zod'

import { AuthenticatedShell } from '@/components/layouts/authenticated-shell'
import type { SessionQuotaSummary } from '@/components/layouts/authenticated-shell'
import { apiFetch } from '@/lib/api/server-client'
import { createRequireSession } from '@/lib/auth/require-session'

interface AuthenticatedLayoutProps {
  readonly children: ReactNode
}

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

function sessionQuotaSummary(quota: z.output<typeof quotaSchema>): SessionQuotaSummary | null {
  if (!quota.enforced) return null

  return {
    allowance: quota.allowance,
    remaining: quota.remaining,
    renewsAt: quota.renewsAt,
  }
}

export default async function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  const [cookieStore, quota] = await Promise.all([
    cookies(),
    apiFetch('/sessions/quota', { cache: 'no-store', schema: quotaSchema }),
  ])
  createRequireSession({ cookieStore, redirect })()
  const isSidebarExpanded = cookieStore.get(SIDEBAR_PREFERENCE_COOKIE_NAME)?.value !== 'false'

  return (
    <AuthenticatedShell
      initialIsExpanded={isSidebarExpanded}
      preferenceCookieName={SIDEBAR_PREFERENCE_COOKIE_NAME}
      quota={sessionQuotaSummary(quota)}
    >
      {children}
    </AuthenticatedShell>
  )
}

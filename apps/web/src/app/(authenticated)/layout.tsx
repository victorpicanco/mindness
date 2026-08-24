import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'

import { AuthenticatedShell } from '@/components/layouts/authenticated-shell'
import { createRequireSession } from '@/lib/auth/require-session'

interface AuthenticatedLayoutProps {
  readonly children: ReactNode
}

const SIDEBAR_PREFERENCE_COOKIE_NAME = 'mindness-sidebar-expanded'

export default async function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  const cookieStore = await cookies()
  createRequireSession({ cookieStore, redirect })()
  const isSidebarExpanded = cookieStore.get(SIDEBAR_PREFERENCE_COOKIE_NAME)?.value !== 'false'

  return (
    <AuthenticatedShell
      initialIsExpanded={isSidebarExpanded}
      preferenceCookieName={SIDEBAR_PREFERENCE_COOKIE_NAME}
    >
      {children}
    </AuthenticatedShell>
  )
}

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'

import { createRequireSession } from '@/lib/auth/require-session'

interface AuthenticatedLayoutProps {
  readonly children: ReactNode
}

export default async function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  createRequireSession({ cookieStore: await cookies(), redirect })()

  return children
}

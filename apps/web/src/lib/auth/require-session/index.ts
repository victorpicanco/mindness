import { SIGNED_IN_HOME } from '@/lib/auth/redirect-target'
import { hasLiveSession } from '@/lib/auth/session'

type CookieStore = Parameters<typeof hasLiveSession>[0]

type RequireSessionDependencies = {
  readonly cookieStore: CookieStore
  readonly redirect: (path: string) => never
}
export function createRequireSession({
  cookieStore,
  redirect,
}: RequireSessionDependencies): () => void {
  return function requireSession(): void {
    if (!hasLiveSession(cookieStore)) redirect(SIGNED_IN_HOME)
  }
}

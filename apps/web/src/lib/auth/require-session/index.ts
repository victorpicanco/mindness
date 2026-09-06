import { hasLiveSession } from '@/lib/auth/session'

const SIGN_IN_ROUTE = '/auth/sign-in'

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
    if (!hasLiveSession(cookieStore)) redirect(SIGN_IN_ROUTE)
  }
}

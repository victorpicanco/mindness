import { hasLiveSession } from '@/lib/auth/session'

const SIGN_IN_ROUTE = '/auth/sign-in'

type CookieStore = Parameters<typeof hasLiveSession>[0]

type RequireSessionDependencies = {
  readonly cookieStore: CookieStore
  readonly redirect: (path: string) => never
}

// The proxy already gates these routes; this is the second lock, for any render
// its matcher does not reach.
export function createRequireSession({
  cookieStore,
  redirect,
}: RequireSessionDependencies): () => void {
  return function requireSession(): void {
    if (!hasLiveSession(cookieStore)) redirect(SIGN_IN_ROUTE)
  }
}

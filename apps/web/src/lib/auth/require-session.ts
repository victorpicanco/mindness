import { hasLiveSession } from './session'

const SIGN_IN_ROUTE = '/auth/sign-in'

type CookieStore = Parameters<typeof hasLiveSession>[0]

type RequireSessionDependencies = {
  readonly cookieStore: CookieStore
  readonly redirect: (path: string) => never
}

// The proxy gates these routes too, but it is skipped for prefetch requests,
// so a protected page has to refuse to render its payload on its own.
export function createRequireSession({
  cookieStore,
  redirect,
}: RequireSessionDependencies): () => void {
  return function requireSession(): void {
    if (!hasLiveSession(cookieStore)) redirect(SIGN_IN_ROUTE)
  }
}

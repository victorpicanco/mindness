const ACCESS_TOKEN_COOKIE_NAME = 'mindness_access_token'
const REFRESH_TOKEN_COOKIE_NAME = 'mindness_refresh_token'

// Matches the Supabase refresh token lifetime: the access token inside expires
// in an hour, but the cookie has to survive a browser restart for the BFF to be
// able to refresh it.
const SESSION_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60

type SessionCookieOptions = {
  httpOnly: boolean
  maxAge: number
  path: string
  sameSite: 'lax'
  secure: boolean
}

type SessionCookieReader = {
  get(name: string): { value: string } | undefined
}

type SessionCookieEraser = {
  delete(name: string): void
}

export type SessionCookieStore = SessionCookieReader &
  SessionCookieEraser & {
    set(name: string, value: string, options: SessionCookieOptions): void
  }

type SessionCookie = {
  name: string
  value: string
  options: SessionCookieOptions
}

type SessionCookies = {
  accessToken: string | undefined
  refreshToken: string | undefined
}

export type SessionTokens = {
  accessToken: string
  refreshToken: string
}

function createSessionCookieOptions(): SessionCookieOptions {
  return {
    httpOnly: true,
    maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  }
}

export function readSessionCookies(store: SessionCookieReader): SessionCookies {
  return {
    accessToken: store.get(ACCESS_TOKEN_COOKIE_NAME)?.value,
    refreshToken: store.get(REFRESH_TOKEN_COOKIE_NAME)?.value,
  }
}

export function sessionCookiesToSet(tokens: SessionTokens): readonly SessionCookie[] {
  const options = createSessionCookieOptions()

  return [
    { name: ACCESS_TOKEN_COOKIE_NAME, value: tokens.accessToken, options },
    { name: REFRESH_TOKEN_COOKIE_NAME, value: tokens.refreshToken, options },
  ]
}

export function writeSessionCookies(store: SessionCookieStore, tokens: SessionTokens): void {
  for (const { name, value, options } of sessionCookiesToSet(tokens)) {
    store.set(name, value, options)
  }
}

export function clearSessionCookies(store: SessionCookieEraser): void {
  store.delete(ACCESS_TOKEN_COOKIE_NAME)
  store.delete(REFRESH_TOKEN_COOKIE_NAME)
}

function accessTokenIsLive(accessToken: string, nowInSeconds: number): boolean {
  const payload = accessToken.split('.')[1]
  if (payload === undefined || payload === '') return false

  try {
    const decoded: unknown = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    if (typeof decoded !== 'object' || decoded === null || !('exp' in decoded)) return false

    return typeof decoded.exp === 'number' && decoded.exp > nowInSeconds
  } catch {
    return false
  }
}

// A refresh token alone is enough: the BFF renews the access token on the first
// 401 and clears both cookies when the renewal fails, so an hour of idleness
// must not read as a sign-out.
export function hasLiveSession(
  store: SessionCookieReader,
  nowInSeconds = Date.now() / 1000,
): boolean {
  const { accessToken, refreshToken } = readSessionCookies(store)

  if (refreshToken !== undefined) return true

  return accessToken !== undefined && accessTokenIsLive(accessToken, nowInSeconds)
}

// The proxy renews the access token before a render reads it, because a Server
// Component may only read cookies: writing them there throws.
export function needsAccessTokenRefresh(
  store: SessionCookieReader,
  nowInSeconds = Date.now() / 1000,
): boolean {
  const { accessToken, refreshToken } = readSessionCookies(store)

  if (refreshToken === undefined) return false

  return accessToken === undefined || !accessTokenIsLive(accessToken, nowInSeconds)
}

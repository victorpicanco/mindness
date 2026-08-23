const ACCESS_TOKEN_COOKIE_NAME = 'mindness_access_token'
const REFRESH_TOKEN_COOKIE_NAME = 'mindness_refresh_token'

type SessionCookieOptions = {
  httpOnly: boolean
  path: string
  sameSite: 'lax'
  secure: boolean
}

type SessionCookieReader = {
  get(name: string): { value: string } | undefined
}

type SessionCookieStore = SessionCookieReader & {
  set(name: string, value: string, options: SessionCookieOptions): void
  delete(name: string): void
}

type SessionCookies = {
  accessToken: string | undefined
  refreshToken: string | undefined
}

type SessionTokens = {
  accessToken: string
  refreshToken: string
}

function createSessionCookieOptions(): SessionCookieOptions {
  return {
    httpOnly: true,
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

export function writeSessionCookies(store: SessionCookieStore, tokens: SessionTokens): void {
  const options = createSessionCookieOptions()

  store.set(ACCESS_TOKEN_COOKIE_NAME, tokens.accessToken, options)
  store.set(REFRESH_TOKEN_COOKIE_NAME, tokens.refreshToken, options)
}

export function clearSessionCookies(store: SessionCookieStore): void {
  store.delete(ACCESS_TOKEN_COOKIE_NAME)
  store.delete(REFRESH_TOKEN_COOKIE_NAME)
}

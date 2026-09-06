export const REDIRECT_PARAM_NAME = 'redirect'
export const REDIRECT_FIELD_NAME = 'redirectTo'
export const SIGNED_IN_HOME = '/'

const LOCAL_ORIGIN = 'https://redirect-target.invalid'
export function safeRedirectPath(candidate: unknown): string {
  if (typeof candidate !== 'string' || !candidate.startsWith('/')) return SIGNED_IN_HOME

  const url = new URL(candidate, LOCAL_ORIGIN)
  if (url.origin !== LOCAL_ORIGIN) return SIGNED_IN_HOME

  const path = `${url.pathname}${url.search}`

  return path.startsWith('/auth/') ? SIGNED_IN_HOME : path
}

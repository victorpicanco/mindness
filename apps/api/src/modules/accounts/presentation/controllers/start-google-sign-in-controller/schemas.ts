// LAW-005.5: the authorization start takes no client input; the callback destination is
// owned by the server so that no caller can turn it into an open redirect.
export const GOOGLE_PKCE_COOKIE = 'accounts_google_pkce'
export const GOOGLE_PKCE_COOKIE_MAX_AGE_SECONDS = 600

export const GUEST_TRIAL_COOKIE_NAME = 'mindness_guest_trial_used'

const GUEST_TRIAL_COOKIE_VALUE = 'true'
const GUEST_TRIAL_COOKIE_MAX_AGE_SECONDS = 365 * 24 * 60 * 60

type GuestTrialCookieOptions = {
  httpOnly: boolean
  maxAge: number
  path: string
  sameSite: 'lax'
  secure: boolean
}

export type GuestTrialCookieReader = {
  get(name: string): { value: string } | undefined
}

export type GuestTrialCookieStore = GuestTrialCookieReader & {
  set(name: string, value: string, options: GuestTrialCookieOptions): void
}

export function hasUsedGuestTrial(store: GuestTrialCookieReader): boolean {
  return store.get(GUEST_TRIAL_COOKIE_NAME)?.value === GUEST_TRIAL_COOKIE_VALUE
}

export function markGuestTrialUsed(store: GuestTrialCookieStore): void {
  store.set(GUEST_TRIAL_COOKIE_NAME, GUEST_TRIAL_COOKIE_VALUE, {
    httpOnly: true,
    maxAge: GUEST_TRIAL_COOKIE_MAX_AGE_SECONDS,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  })
}

import { z } from 'zod'

import { apiErrorDetails } from '@/lib/api/api-error'
import { apiFetch } from '@/lib/api/server-client'
import { acceptConsent } from '@/lib/auth/accept-consent'
import { hasUsedGuestTrial } from '@/lib/auth/guest-trial'
import { provisionAccount } from '@/lib/auth/provision-account'
import { REDIRECT_FIELD_NAME, safeRedirectPath } from '@/lib/auth/redirect-target'
import {
  clearSessionCookies,
  hasGuestSession,
  readSessionCookies,
  type SessionCookieStore,
  writeSessionCookies,
} from '@/lib/auth/session'
import { createPostHogClient, type AnalyticsClient } from '@/lib/analytics/posthog-server'

import type { AuthActionState, StartGuestTrialState } from '@/lib/auth/action-state'
import {
  captchaTokenSchema,
  credentialsMessageKey,
  emailSchema,
  signInPasswordSchema,
} from '@/lib/auth/credentials'
import { formFieldValue } from '@/lib/auth/form-validation'
import { passwordSchema } from '@/lib/auth/password-policy'

const messageSchema = z.object({ message: z.string() })
const signInResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresAt: z.iso.datetime(),
})
const analyticsDistinctIdSchema = z.string().trim().min(1).max(200)

type CookieStore = SessionCookieStore
type EmailRequestPath = '/auth/email/resend' | '/auth/password/recovery'

type CommonDependencies = {
  readonly analytics?: AnalyticsClient
  readonly cookieStore: CookieStore
  readonly fetcher: typeof fetch
}

const EMAIL_REQUEST_ANALYTICS_EVENTS: Readonly<Record<EmailRequestPath, string>> = {
  '/auth/email/resend': 'email_confirmation_resend_requested',
  '/auth/password/recovery': 'password_recovery_requested',
}

function analyticsDistinctId(formData: FormData): string | undefined {
  const parsed = analyticsDistinctIdSchema.safeParse(
    formFieldValue(formData, 'anonymousDistinctId'),
  )

  return parsed.success ? parsed.data : undefined
}

async function reportAnalytics(analytics: AnalyticsClient, report: () => void): Promise<void> {
  try {
    report()
    await analytics.flush()
  } catch {
    return
  }
}

function captureAnonymousAuth(
  analytics: AnalyticsClient,
  distinctId: string | undefined,
  event: 'anonymous_auth_failed' | 'anonymous_auth_succeeded',
  errorCode?: string,
): Promise<void> {
  if (distinctId === undefined) return Promise.resolve()

  return reportAnalytics(analytics, () => {
    analytics.capture({
      distinctId,
      event,
      ...(errorCode === undefined ? {} : { properties: { error_code: errorCode } }),
    })
  })
}

export function createSignInAction({
  analytics = createPostHogClient(),
  cookieStore,
  fetcher,
  redirect: navigate,
}: CommonDependencies & { readonly redirect: (path: string) => never }) {
  return async function signInAction(
    _previousState: AuthActionState,
    formData: FormData,
  ): Promise<AuthActionState> {
    const credentials = {
      captchaToken: formFieldValue(formData, 'captchaToken'),
      email: formFieldValue(formData, 'email'),
      password: formFieldValue(formData, 'password'),
    }
    const invalidMessageKey = credentialsMessageKey(credentials, signInPasswordSchema)

    if (invalidMessageKey !== undefined) {
      return { status: 'validation-error', messageKey: invalidMessageKey }
    }

    let session: z.infer<typeof signInResponseSchema>

    try {
      session = await apiFetch('/auth/sign-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
        cookieStore,
        fetcher,
        schema: signInResponseSchema,
      })
    } catch (error: unknown) {
      return { status: 'api-error', error: apiErrorDetails(error) }
    }

    writeSessionCookies(cookieStore, session)
    const provisionError = await provisionAccount({ cookieStore, fetcher })

    if (provisionError !== null) return { status: 'api-error', error: provisionError }

    await reportAnalytics(analytics, () => {
      analytics.capture({ distinctId: credentials.email, event: 'sign_in_server' })
      analytics.identify({
        distinctId: credentials.email,
        properties: { email: credentials.email },
      })
    })

    return navigate(safeRedirectPath(formFieldValue(formData, REDIRECT_FIELD_NAME)))
  }
}

export function createSignUpAction({
  analytics = createPostHogClient(),
  cookieStore,
  fetcher,
}: CommonDependencies) {
  return async function signUpAction(
    _previousState: AuthActionState,
    formData: FormData,
  ): Promise<AuthActionState> {
    const credentials = {
      captchaToken: formFieldValue(formData, 'captchaToken'),
      email: formFieldValue(formData, 'email'),
      password: formFieldValue(formData, 'password'),
    }
    const invalidMessageKey = credentialsMessageKey(credentials, passwordSchema)

    if (invalidMessageKey !== undefined) {
      return { status: 'validation-error', messageKey: invalidMessageKey }
    }

    if (formFieldValue(formData, 'passwordConfirmation') !== credentials.password) {
      return { status: 'validation-error', messageKey: 'errors.passwordMismatch' }
    }

    try {
      await apiFetch('/auth/sign-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
        cookieStore,
        fetcher,
        schema: messageSchema,
      })
    } catch (error: unknown) {
      return { status: 'api-error', error: apiErrorDetails(error) }
    }

    await reportAnalytics(analytics, () => {
      analytics.capture({ distinctId: credentials.email, event: 'sign_up_server' })
      analytics.identify({
        distinctId: credentials.email,
        properties: { email: credentials.email },
      })
    })

    return { status: 'success' }
  }
}

export function createEmailRequestAction({
  analytics = createPostHogClient(),
  path,
  cookieStore,
  fetcher,
}: CommonDependencies & { readonly path: EmailRequestPath }) {
  return async function emailRequestAction(
    _previousState: AuthActionState,
    formData: FormData,
  ): Promise<AuthActionState> {
    const captchaToken = formFieldValue(formData, 'captchaToken')
    const email = formFieldValue(formData, 'email')

    if (!captchaTokenSchema.safeParse(captchaToken).success) {
      return { status: 'validation-error', messageKey: 'errors.captchaRequired' }
    }

    if (!emailSchema.safeParse(email).success) {
      return { status: 'validation-error', messageKey: 'errors.invalidEmail' }
    }

    try {
      await apiFetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, captchaToken }),
        cookieStore,
        fetcher,
        schema: messageSchema,
      })
    } catch (error: unknown) {
      return { status: 'api-error', error: apiErrorDetails(error) }
    }

    await reportAnalytics(analytics, () => {
      analytics.capture({ distinctId: email, event: EMAIL_REQUEST_ANALYTICS_EVENTS[path] })
    })

    return { status: 'success' }
  }
}

export function createUpdatePasswordAction({
  cookieStore,
  fetcher,
  redirect,
}: CommonDependencies & { readonly redirect: (path: string) => never }) {
  return async function updatePasswordAction(
    _previousState: AuthActionState,
    formData: FormData,
  ): Promise<AuthActionState> {
    const password = passwordSchema.safeParse(formFieldValue(formData, 'password'))

    if (!password.success) {
      return { status: 'validation-error', messageKey: 'errors.invalidPassword' }
    }

    try {
      await apiFetch('/auth/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: password.data }),
        cookieStore,
        fetcher,
        schema: messageSchema,
      })
    } catch (error: unknown) {
      return { status: 'api-error', error: apiErrorDetails(error) }
    }

    clearSessionCookies(cookieStore)

    return redirect('/?status=password-updated')
  }
}

export function createSignOutAction({
  cookieStore,
  fetcher,
  redirect,
}: CommonDependencies & { readonly redirect: (path: string) => never }) {
  return async function signOutAction(): Promise<void> {
    const { accessToken } = readSessionCookies(cookieStore)
    try {
      if (accessToken !== undefined) {
        await apiFetch('/auth/sign-out', {
          method: 'POST',
          cookieStore,
          fetcher,
          schema: messageSchema,
        })
      }
    } finally {
      clearSessionCookies(cookieStore)
      redirect('/')
    }
  }
}

export function createStartGuestTrialAction({
  analytics = createPostHogClient(),
  cookieStore,
  fetcher,
}: CommonDependencies) {
  return async function startGuestTrialAction(
    _previousState: StartGuestTrialState,
    formData: FormData,
  ): Promise<StartGuestTrialState> {
    if (hasUsedGuestTrial(cookieStore)) return { status: 'account-required' }
    if (hasGuestSession(cookieStore)) return { status: 'started' }

    const captchaToken = formFieldValue(formData, 'captchaToken')
    const distinctId = analyticsDistinctId(formData)

    if (!captchaTokenSchema.safeParse(captchaToken).success) {
      return { status: 'captcha-required' }
    }

    let session: z.infer<typeof signInResponseSchema>

    try {
      session = await apiFetch('/auth/anonymous', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ captchaToken }),
        cookieStore,
        fetcher,
        schema: signInResponseSchema,
      })
    } catch (error: unknown) {
      const details = apiErrorDetails(error)
      await captureAnonymousAuth(analytics, distinctId, 'anonymous_auth_failed', details.code)

      return { status: 'api-error', error: details }
    }

    await captureAnonymousAuth(analytics, distinctId, 'anonymous_auth_succeeded')

    writeSessionCookies(cookieStore, session)

    try {
      await apiFetch('/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeZone: null }),
        cookieStore,
        fetcher,
        schema: messageSchema,
      })
    } catch (error: unknown) {
      clearSessionCookies(cookieStore)

      return { status: 'api-error', error: apiErrorDetails(error) }
    }

    const consentError = await acceptConsent({ cookieStore, fetcher })

    if (consentError !== null) {
      clearSessionCookies(cookieStore)

      return { status: 'api-error', error: consentError }
    }

    return { status: 'started' }
  }
}

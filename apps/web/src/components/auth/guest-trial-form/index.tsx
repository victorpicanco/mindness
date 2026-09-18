'use client'

import { useTranslations } from 'next-intl'
import { useActionState, useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Turnstile } from '@/components/ui/turnstile'
import { AnonymousDistinctIdField } from '@/components/analytics/anonymous-distinct-id-field'
import { browserAnalyticsClient, type BrowserAnalyticsClient } from '@/lib/analytics/browser-client'
import {
  initialStartGuestTrialState,
  type StartGuestTrialAction,
  type StartGuestTrialState,
} from '@/lib/auth/action-state'
import { clientEnv } from '@/lib/env/client'
import { describeApiError, type ApiErrorMessageKey } from '@/lib/errors/api-error-presentation'
import { showApiErrorAlert } from '@/lib/errors/show-api-error-alert'
import { showApiErrorToast } from '@/lib/errors/show-api-error-toast'
import { runGuestTrialExclusively } from '@/lib/auth/guest-trial-lock'

type GuestTrialTranslator = (key: 'auth.errors.captchaRequired' | ApiErrorMessageKey) => string

function captchaErrorMessage(
  state: StartGuestTrialState,
  translate: GuestTrialTranslator,
): string | undefined {
  if (state.status === 'captcha-required') return translate('auth.errors.captchaRequired')
  if (state.status !== 'api-error') return undefined

  const description = describeApiError(state.error.code)

  return description.presentation === 'inline' && description.field === 'captchaToken'
    ? translate(description.messageKey)
    : undefined
}

function hasFailed(state: StartGuestTrialState): boolean {
  return state.status === 'captcha-required' || state.status === 'api-error'
}

type GuestTrialFormProps = {
  readonly analytics?: BrowserAnalyticsClient
  readonly appearance?: 'compact' | 'default' | undefined
  readonly onAccountRequired: () => void
  readonly onStarted: () => void
  readonly startGuestTrial: StartGuestTrialAction
}

export function GuestTrialForm({
  analytics = browserAnalyticsClient,
  appearance = 'default',
  onAccountRequired,
  onStarted,
  startGuestTrial,
}: GuestTrialFormProps) {
  const t = useTranslations('home.practice.accountEntryDialog')
  const translate = useTranslations()
  const [state, formAction, isSubmitting] = useActionState(
    (previousState: StartGuestTrialState, formData: FormData) =>
      runGuestTrialExclusively(() => startGuestTrial(previousState, formData)),
    initialStartGuestTrialState,
  )
  const reportedStateRef = useRef(state)
  const siteKey = clientEnv().turnstileSiteKey
  const [captchaToken, setCaptchaToken] = useState('')
  const captchaPending = siteKey !== undefined && captchaToken === ''

  useEffect(() => {
    if (reportedStateRef.current === state) return

    reportedStateRef.current = state

    if (state.status === 'started') onStarted()
    if (state.status === 'account-required') onAccountRequired()
  }, [onAccountRequired, onStarted, state])

  useEffect(() => {
    if (state.status !== 'api-error') return

    showApiErrorToast(state.error, translate)
    showApiErrorAlert(state.error, translate)
  }, [state, translate])

  const captchaError = captchaErrorMessage(state, translate)
  const isCompact = appearance === 'compact'

  return (
    <form
      action={formAction}
      className={isCompact ? 'grid justify-items-end gap-1' : 'grid gap-3'}
      onSubmit={() => analytics.capture('anonymous_trial_selected')}
    >
      <AnonymousDistinctIdField getDistinctId={() => analytics.getDistinctId()} />
      {siteKey === undefined ? null : (
        <div className="grid gap-1.5">
          <Turnstile onTokenChange={setCaptchaToken} resetSignal={state} siteKey={siteKey} />
          {captchaError === undefined ? null : (
            <p className="text-sm text-error" role="alert">
              {captchaError}
            </p>
          )}
        </div>
      )}
      <Button
        className={isCompact ? 'px-2 text-sm' : undefined}
        disabled={siteKey === undefined || captchaPending}
        isLoading={isSubmitting || captchaPending}
        size={isCompact ? 'sm' : undefined}
        type="submit"
        variant={isCompact ? 'ghost' : 'secondary'}
      >
        {hasFailed(state) ? t('retry') : t('continueWithoutAccount')}
      </Button>
    </form>
  )
}

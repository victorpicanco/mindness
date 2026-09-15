'use client'

import { useTranslations } from 'next-intl'
import { useId, useState } from 'react'

import { GuestTrialForm } from '@/components/auth/guest-trial-form'
import { SignInForm } from '@/components/auth/sign-in-form'
import { SignInShowcase } from '@/components/auth/sign-in-showcase'
import { SignUpForm } from '@/components/auth/sign-up-form'
import { browserAnalyticsClient, type BrowserAnalyticsClient } from '@/lib/analytics/browser-client'
import type { AuthFormAction, StartGuestTrialAction } from '@/lib/auth/action-state'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import type { ApiErrorDescription } from '@/lib/errors/api-error-presentation'

export type AuthenticationMode = 'sign-in' | 'sign-up'

function tabButtonClassName(isActive: boolean): string {
  const sharedClassName =
    'inline-flex min-h-8 w-full cursor-pointer items-center justify-center rounded-full px-3 text-sm font-medium transition-[background-color,color,box-shadow] duration-200 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text'

  return isActive
    ? `${sharedClassName} bg-surface text-text shadow-sm`
    : `${sharedClassName} bg-transparent text-text-muted hover:bg-surface-raised hover:text-text`
}

interface AuthenticationDialogProps {
  readonly analytics?: BrowserAnalyticsClient
  readonly canContinueWithoutAccount?: boolean | undefined
  readonly initialError?: ApiErrorDescription | undefined
  readonly mode: AuthenticationMode | null
  readonly onClose: () => void
  readonly onContinueWithoutAccount?: () => void
  readonly onGuestTrialAccountRequired?: () => void
  readonly onGuestTrialStarted?: () => void
  readonly onModeChange: (mode: AuthenticationMode) => void
  readonly passwordUpdated?: boolean | undefined
  readonly signInAction?: AuthFormAction | undefined
  readonly signUpAction?: AuthFormAction | undefined
  readonly startGuestTrial?: StartGuestTrialAction | undefined
}

export function AuthenticationDialog({
  analytics = browserAnalyticsClient,
  canContinueWithoutAccount = true,
  initialError,
  mode,
  onClose,
  onContinueWithoutAccount = onClose,
  onGuestTrialAccountRequired = onClose,
  onGuestTrialStarted = onClose,
  onModeChange,
  passwordUpdated = false,
  signInAction,
  signUpAction,
  startGuestTrial,
}: AuthenticationDialogProps) {
  const t = useTranslations('auth.authenticationDialog')
  const signIn = useTranslations('auth.signIn')
  const signUp = useTranslations('auth.signUp')
  const [hasSignedUp, setHasSignedUp] = useState(false)
  const tabId = useId()
  const isSignIn = mode !== 'sign-up'

  if (mode === null || signInAction === undefined || signUpAction === undefined) return null

  return (
    <Dialog
      appearance="split"
      desktopAside={<SignInShowcase brandName={t('title')} layout="dialog" />}
      description={isSignIn ? signIn('description') : signUp('description')}
      onClose={onClose}
      open
      splitContentTestId="authentication-dialog-content"
      title={isSignIn ? signIn('title') : signUp('title')}
    >
      <div className="flex min-h-full flex-col gap-6 lg:h-full lg:min-h-0">
        <div
          aria-label={t('tabs.label')}
          className="grid grid-cols-2 gap-1 rounded-full bg-input p-1"
          role="tablist"
        >
          <button
            aria-controls={`${tabId}-panel`}
            aria-selected={isSignIn}
            className={tabButtonClassName(isSignIn)}
            id={`${tabId}-sign-in`}
            onClick={() => onModeChange('sign-in')}
            role="tab"
            type="button"
          >
            {t('tabs.signIn')}
          </button>
          <button
            aria-controls={`${tabId}-panel`}
            aria-selected={!isSignIn}
            className={tabButtonClassName(!isSignIn)}
            id={`${tabId}-sign-up`}
            onClick={() => {
              setHasSignedUp(false)
              onModeChange('sign-up')
            }}
            role="tab"
            type="button"
          >
            {t('tabs.signUp')}
          </button>
        </div>

        <section
          aria-labelledby={`${tabId}-${isSignIn ? 'sign-in' : 'sign-up'}`}
          className="grid content-start gap-5 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-1"
          id={`${tabId}-panel`}
          role="tabpanel"
        >
          {isSignIn ? (
            <>
              <div className="grid gap-2">
                <h2 className="font-(family-name:--font-buenard) text-3xl font-normal leading-none">
                  {t('welcome')}
                </h2>
                <p className="text-sm font-normal text-text-muted">{t('welcomeDescription')}</p>
              </div>
              <SignInForm action={signInAction} appearance="dialog" initialError={initialError} />
              {passwordUpdated ? (
                <p className="text-sm text-text-muted" role="status">
                  {signIn('passwordUpdated')}
                </p>
              ) : null}
            </>
          ) : hasSignedUp ? (
            <p className="text-sm text-text-muted" role="status">
              {signUp('success')}
            </p>
          ) : (
            <>
              <div className="grid gap-2">
                <h2
                  className="font-(family-name:--font-buenard) text-3xl font-normal leading-none"
                  data-testid="authentication-dialog-sign-up-welcome"
                >
                  {signUp('title')}
                </h2>
                <p className="text-sm font-normal text-text-muted">
                  {t('signUpWelcomeDescription')}
                </p>
              </div>
              <SignUpForm
                action={signUpAction}
                appearance="dialog"
                onSuccess={() => setHasSignedUp(true)}
              />
            </>
          )}
        </section>

        {canContinueWithoutAccount && startGuestTrial !== undefined ? (
          <div className="mt-auto self-end">
            <GuestTrialForm
              analytics={analytics}
              appearance="compact"
              onAccountRequired={onGuestTrialAccountRequired}
              onStarted={onGuestTrialStarted}
              startGuestTrial={startGuestTrial}
            />
          </div>
        ) : null}
        {canContinueWithoutAccount && startGuestTrial === undefined ? (
          <Button
            className="mt-auto justify-self-end self-end px-2 text-sm"
            onClick={onContinueWithoutAccount}
            size="sm"
            type="button"
            variant="ghost"
          >
            {t('continueWithoutAccount')}
          </Button>
        ) : null}
      </div>
    </Dialog>
  )
}

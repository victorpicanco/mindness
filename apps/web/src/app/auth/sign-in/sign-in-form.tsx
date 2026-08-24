'use client'

import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useEffect, useRef } from 'react'
import { toast } from 'sonner'

import { signInAction } from './actions'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { REDIRECT_FIELD_NAME } from '@/lib/auth/redirect-target'
import type { ApiErrorDescription } from '@/lib/errors/api-error-presentation'

import { AuthCaptchaField } from '../auth-captcha-field'
import { AuthFormAlert } from '../auth-form-alert'
import { isValidEmail } from '../auth-credentials'
import { formFieldValue } from '../form-validation'
import { useAuthForm, type AuthFieldErrors, type AuthFormAction } from '../use-auth-form'

const EMAIL_NOT_CONFIRMED_CODE = 'accounts.EMAIL_NOT_CONFIRMED'

type SignInFormProps = {
  readonly action?: AuthFormAction
  readonly initialError?: ApiErrorDescription
  readonly redirectTo?: string
}

function googleAuthorizationUrl(): string {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL

  return apiBaseUrl === undefined ? '/auth/google' : `${apiBaseUrl}/auth/google`
}

function validate(formData: FormData): AuthFieldErrors {
  const errors: { -readonly [Key in keyof AuthFieldErrors]: AuthFieldErrors[Key] } = {}

  if (!isValidEmail(formFieldValue(formData, 'email'))) {
    errors.email = 'auth.errors.invalidEmail'
  }

  if (formFieldValue(formData, 'password') === '') {
    errors.password = 'auth.errors.passwordRequired'
  }

  return errors
}

export function SignInForm({ action = signInAction, initialError, redirectTo }: SignInFormProps) {
  const t = useTranslations('auth')
  const translate = useTranslations()
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
  const form = useAuthForm({ action, requiresCaptcha: siteKey !== undefined, validate })
  const announcedInitialError = useRef(false)

  useEffect(() => {
    if (announcedInitialError.current) return
    if (initialError === undefined || initialError.presentation !== 'toast') return

    announcedInitialError.current = true
    toast.error(translate(initialError.messageKey))
  }, [initialError, translate])

  const alertMessageKey = ((): typeof form.inlineMessageKey => {
    if (siteKey === undefined) return 'auth.errors.captchaUnavailable'
    if (form.inlineMessageKey !== undefined) return form.inlineMessageKey

    return form.state.status === 'idle' && initialError?.presentation === 'inline'
      ? initialError.messageKey
      : undefined
  })()

  const needsEmailConfirmation =
    form.state.status === 'api-error' && form.state.error.code === EMAIL_NOT_CONFIRMED_CODE

  return (
    <form className="grid gap-8" noValidate onSubmit={form.onSubmit}>
      {redirectTo === undefined ? null : (
        <input name={REDIRECT_FIELD_NAME} type="hidden" value={redirectTo} />
      )}
      <div className="grid gap-4">
        <a
          className="inline-flex min-h-14 items-center justify-center rounded-full border border-border px-6 py-4 text-base font-medium text-text transition-colors hover:border-text-muted hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text"
          href={googleAuthorizationUrl()}
        >
          {t('signIn.google')}
        </a>
        <p className="text-xs text-text-muted">{t('consent.notice')}</p>
        <div className="flex items-center gap-3 text-xs text-text-muted" role="separator">
          <span className="h-px flex-1 bg-divider" />
          {t('signIn.divider')}
          <span className="h-px flex-1 bg-divider" />
        </div>
      </div>
      <div className="grid gap-4">
        <Field
          {...(form.fieldErrors.email === undefined
            ? {}
            : { error: translate(form.fieldErrors.email) })}
          label={t('signIn.emailLabel')}
        >
          <Input
            autoComplete="email"
            name="email"
            placeholder={t('signIn.emailPlaceholder')}
            type="email"
          />
        </Field>
        <div className="grid gap-1">
          <Field
            {...(form.fieldErrors.password === undefined
              ? {}
              : { error: translate(form.fieldErrors.password) })}
            label={t('signIn.passwordLabel')}
          >
            <PasswordInput
              autoComplete="current-password"
              hidePasswordLabel={t('password.hide')}
              name="password"
              placeholder={t('signIn.passwordPlaceholder')}
              showPasswordLabel={t('password.show')}
            />
          </Field>
          <Link
            className="justify-self-end text-sm font-medium text-text underline-offset-2 hover:underline"
            href="/auth/password-recovery"
          >
            {t('signIn.forgotPassword')}
          </Link>
        </div>
      </div>
      {siteKey === undefined ? null : (
        <AuthCaptchaField
          {...(form.fieldErrors.captchaToken === undefined
            ? {}
            : { errorMessageKey: form.fieldErrors.captchaToken })}
          onError={form.onCaptchaError}
          onTokenChange={form.onCaptchaTokenChange}
          resetSignal={form.captchaResetSignal}
          siteKey={siteKey}
        />
      )}
      <div className="grid gap-4">
        <AuthFormAlert
          {...(alertMessageKey === undefined ? {} : { messageKey: alertMessageKey })}
        />
        {needsEmailConfirmation ? (
          <Link
            className="text-center text-sm font-medium text-text underline-offset-2 hover:underline"
            href="/auth/resend-confirmation"
          >
            {t('signIn.resendConfirmation')}
          </Link>
        ) : null}
        <Button
          className="w-full"
          disabled={siteKey === undefined}
          isLoading={form.isSubmitting}
          size="lg"
          type="submit"
        >
          {t('signIn.submit')}
        </Button>
      </div>
    </form>
  )
}

'use client'

import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useEffect, useRef } from 'react'
import { toast } from 'sonner'

import { AuthCaptchaField } from '@/components/auth/captcha-field'
import { AuthFormAlert } from '@/components/auth/form-alert'
import { LegalNotice } from '@/components/auth/legal-notice'
import { useAuthForm, type AuthFormAction } from '@/components/auth/use-auth-form'
import { Button, buttonStyles } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { REDIRECT_FIELD_NAME } from '@/lib/auth/redirect-target'
import type { ApiErrorDescription } from '@/lib/errors/api-error-presentation'
import { clientEnv } from '@/lib/env/client'

const EMAIL_NOT_CONFIRMED_CODE = 'accounts.EMAIL_NOT_CONFIRMED'

type SignInFormProps = {
  readonly action: AuthFormAction
  readonly initialError?: ApiErrorDescription | undefined
  readonly redirectTo?: string | undefined
}

function googleAuthorizationUrl(): string {
  const { apiBaseUrl } = clientEnv()

  return apiBaseUrl === undefined ? '/auth/google' : `${apiBaseUrl}/auth/google`
}

export function SignInForm({ action, initialError, redirectTo }: SignInFormProps) {
  const t = useTranslations('auth')
  const translate = useTranslations()
  const siteKey = clientEnv().turnstileSiteKey
  const form = useAuthForm({ action, requiresCaptcha: siteKey !== undefined })
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
    <form action={form.formAction} className="grid gap-8" noValidate>
      {redirectTo === undefined ? null : (
        <input name={REDIRECT_FIELD_NAME} type="hidden" value={redirectTo} />
      )}
      <div className="grid gap-4">
        <a
          className={buttonStyles({ size: 'lg', variant: 'secondary' })}
          href={googleAuthorizationUrl()}
        >
          {t('signIn.google')}
        </a>
        <LegalNotice />
        <div className="flex items-center gap-3 text-xs text-text-muted" role="separator">
          <span className="h-px flex-1 bg-divider" />
          {t('signIn.divider')}
          <span className="h-px flex-1 bg-divider" />
        </div>
      </div>
      <div className="grid gap-4">
        <Field
          error={
            form.fieldErrors.email === undefined ? undefined : translate(form.fieldErrors.email)
          }
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
            error={
              form.fieldErrors.password === undefined
                ? undefined
                : translate(form.fieldErrors.password)
            }
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
      <AuthCaptchaField form={form} siteKey={siteKey} />
      <div className="grid gap-4">
        <AuthFormAlert
          message={alertMessageKey === undefined ? undefined : translate(alertMessageKey)}
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

'use client'

import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useEffect, useRef } from 'react'
import { toast } from 'sonner'

import { AuthCaptchaField } from '@/components/auth/captcha-field'
import {
  useAuthForm,
  type AuthFieldErrors,
  type AuthFormAction,
} from '@/components/auth/use-auth-form'
import { Button, buttonStyles } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { REDIRECT_FIELD_NAME } from '@/lib/auth/redirect-target'
import type { ApiErrorDescription } from '@/lib/errors/api-error-presentation'
import { clientEnv } from '@/lib/env/client'
import { showAlertDialog } from '@/lib/feedback/alert-dialog'

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
    if (announcedInitialError.current || initialError === undefined) return
    if (initialError.presentation === 'toast') {
      announcedInitialError.current = true
      toast.error(translate(initialError.messageKey))

      return
    }

    if (initialError.presentation !== 'dialog') return

    announcedInitialError.current = true
    showAlertDialog({
      description: translate(initialError.messageKey),
      title: translate('common.alerts.failureTitle'),
    })
  }, [initialError, translate])

  const fieldErrors: AuthFieldErrors =
    form.state.status === 'idle' && initialError?.presentation === 'inline'
      ? { [initialError.field]: initialError.messageKey }
      : form.fieldErrors

  const needsEmailConfirmation =
    form.state.status === 'api-error' && form.state.error.code === EMAIL_NOT_CONFIRMED_CODE

  return (
    <form action={form.formAction} className="grid gap-5" noValidate>
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
        <div className="flex items-center gap-3 text-xs text-text-muted" role="separator">
          <span className="h-px flex-1 bg-divider" />
          {t('signIn.divider')}
          <span className="h-px flex-1 bg-divider" />
        </div>
      </div>
      <div className="grid gap-4">
        <Field
          error={fieldErrors.email === undefined ? undefined : translate(fieldErrors.email)}
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
            error={fieldErrors.password === undefined ? undefined : translate(fieldErrors.password)}
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

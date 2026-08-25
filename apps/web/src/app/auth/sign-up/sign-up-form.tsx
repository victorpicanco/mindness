'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'

import { signUpAction } from './actions'
import { PasswordChecklist } from './password-checklist'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { clientEnv } from '@/lib/env/client'

import { AuthCaptchaField } from '../auth-captcha-field'
import { AuthFormAlert } from '../auth-form-alert'
import { isValidEmail, isValidNewPassword } from '../auth-credentials'
import { formFieldValue } from '../form-validation'
import { useAuthForm, type AuthFieldErrors, type AuthFormAction } from '../use-auth-form'

type SignUpFormProps = {
  readonly action?: AuthFormAction
  readonly onSuccess?: () => void
}

function validate(formData: FormData): AuthFieldErrors {
  const errors: { -readonly [Key in keyof AuthFieldErrors]: AuthFieldErrors[Key] } = {}
  const password = formFieldValue(formData, 'password')

  if (!isValidEmail(formFieldValue(formData, 'email'))) {
    errors.email = 'auth.errors.invalidEmail'
  }

  if (!isValidNewPassword(password)) {
    errors.password = 'auth.errors.invalidPassword'
  }

  if (formFieldValue(formData, 'passwordConfirmation') !== password) {
    errors.passwordConfirmation = 'auth.errors.passwordMismatch'
  }

  return errors
}

export function SignUpForm({ action = signUpAction, onSuccess }: SignUpFormProps) {
  const t = useTranslations('auth')
  const translate = useTranslations()
  const [password, setPassword] = useState('')
  const siteKey = clientEnv().turnstileSiteKey
  const form = useAuthForm({ action, requiresCaptcha: siteKey !== undefined, validate })

  const alertMessageKey =
    siteKey === undefined ? 'auth.errors.captchaUnavailable' : form.inlineMessageKey

  const hasSucceeded = form.state.status === 'success'

  useEffect(() => {
    if (hasSucceeded) {
      onSuccess?.()
    }
  }, [hasSucceeded, onSuccess])

  if (hasSucceeded) {
    return null
  }

  return (
    <form className="grid gap-8" noValidate onSubmit={form.onSubmit}>
      <div className="grid gap-4">
        <Field
          {...(form.fieldErrors.email === undefined
            ? {}
            : { error: translate(form.fieldErrors.email) })}
          label={t('signUp.emailLabel')}
        >
          <Input
            autoComplete="email"
            name="email"
            placeholder={t('signIn.emailPlaceholder')}
            type="email"
          />
        </Field>
        <Field
          {...(form.fieldErrors.password === undefined
            ? {}
            : { error: translate(form.fieldErrors.password) })}
          label={t('signUp.passwordLabel')}
        >
          <PasswordInput
            autoComplete="new-password"
            hidePasswordLabel={t('password.hide')}
            name="password"
            onChange={(event) => {
              setPassword(event.target.value)
            }}
            placeholder={t('signIn.passwordPlaceholder')}
            showPasswordLabel={t('password.show')}
          />
        </Field>
        <PasswordChecklist
          labels={{
            minimumLength: t('password.requirements.minimumLength'),
            lowercaseLetter: t('password.requirements.lowercaseLetter'),
            uppercaseLetter: t('password.requirements.uppercaseLetter'),
            digit: t('password.requirements.digit'),
            symbol: t('password.requirements.symbol'),
          }}
          password={password}
          title={t('password.requirements.title')}
        />
        <Field
          {...(form.fieldErrors.passwordConfirmation === undefined
            ? {}
            : { error: translate(form.fieldErrors.passwordConfirmation) })}
          label={t('signUp.passwordConfirmationLabel')}
        >
          <PasswordInput
            autoComplete="new-password"
            hidePasswordLabel={t('password.hide')}
            name="passwordConfirmation"
            placeholder={t('signIn.passwordPlaceholder')}
            showPasswordLabel={t('password.show')}
          />
        </Field>
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
        <AuthFormAlert
          {...(alertMessageKey === undefined ? {} : { messageKey: alertMessageKey })}
        />
        <p className="text-xs text-text-muted">{t('consent.notice')}</p>
        <Button
          disabled={siteKey === undefined}
          isLoading={form.isSubmitting}
          size="lg"
          type="submit"
        >
          {t('signUp.submit')}
        </Button>
      </div>
    </form>
  )
}

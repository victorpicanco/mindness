'use client'

import { useTranslations } from 'next-intl'

import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { clientEnv } from '@/lib/env/client'

import { AuthCaptchaField } from '@/components/auth/captcha-field'
import { AuthFormAlert } from '@/components/auth/form-alert'
import {
  useAuthForm,
  type AuthFieldErrors,
  type AuthFormAction,
} from '@/components/auth/use-auth-form'
import { isValidEmail } from '@/lib/auth/credentials'
import { formFieldValue } from '@/lib/auth/form-validation'

function validate(formData: FormData): AuthFieldErrors {
  return isValidEmail(formFieldValue(formData, 'email'))
    ? {}
    : { email: 'auth.errors.invalidEmail' }
}

export function EmailRequestForm({
  action,
  submitLabel,
  successMessage,
}: {
  readonly action: AuthFormAction
  readonly submitLabel: string
  readonly successMessage: string
}) {
  const t = useTranslations('auth')
  const translate = useTranslations()
  const siteKey = clientEnv().turnstileSiteKey
  const form = useAuthForm({ action, requiresCaptcha: siteKey !== undefined, validate })

  const alertMessageKey =
    siteKey === undefined ? 'auth.errors.captchaUnavailable' : form.inlineMessageKey

  return (
    <form className="grid gap-6" noValidate onSubmit={form.onSubmit}>
      <Field
        {...(form.fieldErrors.email === undefined
          ? {}
          : { error: translate(form.fieldErrors.email) })}
        label={t('signIn.emailLabel')}
      >
        <Input autoComplete="email" name="email" type="email" />
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
      {form.state.status === 'success' ? (
        <p className="text-sm text-text-muted" role="status">
          {successMessage}
        </p>
      ) : null}
      <AuthFormAlert {...(alertMessageKey === undefined ? {} : { messageKey: alertMessageKey })} />
      <Button
        disabled={siteKey === undefined}
        isLoading={form.isSubmitting}
        size="lg"
        type="submit"
      >
        {submitLabel}
      </Button>
    </form>
  )
}

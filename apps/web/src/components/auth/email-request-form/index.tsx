'use client'

import { useTranslations } from 'next-intl'

import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { clientEnv } from '@/lib/env/client'

import { AuthCaptchaField } from '@/components/auth/captcha-field'
import { AuthFormAlert } from '@/components/auth/form-alert'
import { useAuthForm, type AuthFormAction } from '@/components/auth/use-auth-form'

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
  const form = useAuthForm({ action, requiresCaptcha: siteKey !== undefined })

  const alertMessageKey =
    siteKey === undefined ? 'auth.errors.captchaUnavailable' : form.inlineMessageKey

  return (
    <form action={form.formAction} className="grid gap-6" noValidate>
      <Field
        error={form.fieldErrors.email === undefined ? undefined : translate(form.fieldErrors.email)}
        label={t('signIn.emailLabel')}
      >
        <Input autoComplete="email" name="email" type="email" />
      </Field>
      <AuthCaptchaField form={form} siteKey={siteKey} />
      {form.state.status === 'success' ? (
        <p className="text-sm text-text-muted" role="status">
          {successMessage}
        </p>
      ) : null}
      <AuthFormAlert
        message={alertMessageKey === undefined ? undefined : translate(alertMessageKey)}
      />
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

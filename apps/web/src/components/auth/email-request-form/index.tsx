'use client'

import { useTranslations } from 'next-intl'
import { useEffect } from 'react'

import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { clientEnv } from '@/lib/env/client'
import { showAlertDialog } from '@/lib/feedback/alert-dialog'

import { AuthCaptchaField } from '@/components/auth/captcha-field'
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
  const hasSucceeded = form.state.status === 'success'

  useEffect(() => {
    if (!hasSucceeded) return

    showAlertDialog({
      description: successMessage,
      title: translate('common.alerts.successTitle'),
    })
  }, [hasSucceeded, successMessage, translate])

  return (
    <form action={form.formAction} className="grid gap-6" noValidate>
      <Field
        error={form.fieldErrors.email === undefined ? undefined : translate(form.fieldErrors.email)}
        label={t('signIn.emailLabel')}
      >
        <Input
          autoComplete="email"
          name="email"
          placeholder={t('signIn.emailPlaceholder')}
          type="email"
        />
      </Field>
      <AuthCaptchaField form={form} siteKey={siteKey} />
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

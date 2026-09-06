'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import posthog from 'posthog-js'

import { AuthCaptchaField } from '@/components/auth/captcha-field'
import { AuthFormAlert } from '@/components/auth/form-alert'
import { LegalNotice } from '@/components/auth/legal-notice'
import { PasswordChecklist } from '@/components/auth/password-checklist'
import { useAuthForm, type AuthFormAction } from '@/components/auth/use-auth-form'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { clientEnv } from '@/lib/env/client'

type SignUpFormProps = {
  readonly action: AuthFormAction
  readonly onSuccess?: () => void
}

export function SignUpForm({ action, onSuccess }: SignUpFormProps) {
  const t = useTranslations('auth')
  const translate = useTranslations()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const siteKey = clientEnv().turnstileSiteKey
  const form = useAuthForm({ action, requiresCaptcha: siteKey !== undefined })

  const alertMessageKey =
    siteKey === undefined ? 'auth.errors.captchaUnavailable' : form.inlineMessageKey

  const hasSucceeded = form.state.status === 'success'

  useEffect(() => {
    if (hasSucceeded) {
      posthog.identify(email, { email })
      posthog.capture('sign_up_submitted')
      onSuccess?.()
    }
  }, [email, hasSucceeded, onSuccess])

  if (hasSucceeded) {
    return null
  }

  return (
    <form action={form.formAction} className="grid gap-8" noValidate>
      <div className="grid gap-4">
        <Field
          error={
            form.fieldErrors.email === undefined ? undefined : translate(form.fieldErrors.email)
          }
          label={t('signUp.emailLabel')}
        >
          <Input
            autoComplete="email"
            name="email"
            onChange={(event) => {
              setEmail(event.target.value)
            }}
            placeholder={t('signIn.emailPlaceholder')}
            type="email"
          />
        </Field>
        <Field
          error={
            form.fieldErrors.password === undefined
              ? undefined
              : translate(form.fieldErrors.password)
          }
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
        <PasswordChecklist password={password} />
        <Field
          error={
            form.fieldErrors.passwordConfirmation === undefined
              ? undefined
              : translate(form.fieldErrors.passwordConfirmation)
          }
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
        <AuthCaptchaField form={form} siteKey={siteKey} />
        <AuthFormAlert
          message={alertMessageKey === undefined ? undefined : translate(alertMessageKey)}
        />
        <LegalNotice />
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

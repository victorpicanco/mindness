'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { PasswordInput } from '@/components/ui/password-input'

import { AuthFormAlert } from '../auth-form-alert'
import { isValidNewPassword } from '../auth-credentials'
import { formFieldValue } from '../form-validation'
import { PasswordChecklist } from '../sign-up/password-checklist'
import { useAuthForm, type AuthFieldErrors, type AuthFormAction } from '../use-auth-form'

import { updatePasswordAction } from './actions'

function validate(formData: FormData): AuthFieldErrors {
  return isValidNewPassword(formFieldValue(formData, 'password'))
    ? {}
    : { password: 'auth.errors.invalidPassword' }
}

export function UpdatePasswordForm({
  action = updatePasswordAction,
}: {
  readonly action?: AuthFormAction
}) {
  const t = useTranslations('auth')
  const translate = useTranslations()
  const [password, setPassword] = useState('')
  const form = useAuthForm({ action, requiresCaptcha: false, validate })

  return (
    <form className="grid gap-6" noValidate onSubmit={form.onSubmit}>
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
      <AuthFormAlert
        {...(form.inlineMessageKey === undefined ? {} : { messageKey: form.inlineMessageKey })}
      />
      <Button isLoading={form.isSubmitting} size="lg" type="submit">
        {t('updatePassword.submit')}
      </Button>
    </form>
  )
}

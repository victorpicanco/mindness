'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'

import { AuthFormAlert } from '@/components/auth/form-alert'
import { PasswordChecklist } from '@/components/auth/password-checklist'
import { useAuthForm, type AuthFormAction } from '@/components/auth/use-auth-form'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { PasswordInput } from '@/components/ui/password-input'

export function UpdatePasswordForm({ action }: { readonly action: AuthFormAction }) {
  const t = useTranslations('auth')
  const translate = useTranslations()
  const [password, setPassword] = useState('')
  const form = useAuthForm({ action, requiresCaptcha: false })

  return (
    <form action={form.formAction} className="grid gap-6" noValidate>
      <Field
        error={
          form.fieldErrors.password === undefined ? undefined : translate(form.fieldErrors.password)
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
          showPasswordLabel={t('password.show')}
        />
      </Field>
      <PasswordChecklist password={password} />
      <AuthFormAlert
        message={form.inlineMessageKey === undefined ? undefined : translate(form.inlineMessageKey)}
      />
      <Button isLoading={form.isSubmitting} size="lg" type="submit">
        {t('updatePassword.submit')}
      </Button>
    </form>
  )
}

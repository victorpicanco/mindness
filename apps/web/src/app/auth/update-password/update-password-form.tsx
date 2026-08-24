'use client'

import { useTranslations } from 'next-intl'
import { useActionState } from 'react'

import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { PasswordInput } from '@/components/ui/password-input'

import { updatePasswordAction } from './actions'

const initialState: { readonly status: 'idle' | 'error' } = { status: 'idle' }

export function UpdatePasswordForm() {
  const t = useTranslations('auth')
  const [state, action, pending] = useActionState(updatePasswordAction, initialState)
  return (
    <form action={action} className="grid gap-6">
      <Field label={t('signUp.passwordLabel')}>
        <PasswordInput
          autoComplete="new-password"
          hidePasswordLabel={t('password.hide')}
          name="password"
          required
          showPasswordLabel={t('password.show')}
        />
      </Field>
      {state.status === 'error' ? (
        <p className="text-sm text-error" role="alert">
          {t('errors.invalidPassword')}
        </p>
      ) : null}
      <Button isLoading={pending} size="lg" type="submit">
        {t('updatePassword.submit')}
      </Button>
    </form>
  )
}

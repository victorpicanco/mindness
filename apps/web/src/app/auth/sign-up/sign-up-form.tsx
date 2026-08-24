'use client'

import { useTranslations } from 'next-intl'
import { type FormEvent, useState } from 'react'

import { signUpAction } from './actions'
import { initialSignUpActionState, type SignUpActionState } from './types'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { showApiErrorToast } from '@/lib/errors/show-api-error-toast'

export type SignUpFormAction = (
  state: SignUpActionState,
  formData: FormData,
) => Promise<SignUpActionState>

type SignUpFormProps = {
  readonly action?: SignUpFormAction
}

type ValidationErrors = {
  readonly email?: string
  readonly password?: string
}

type AuthTranslator = (key: 'errors.invalidEmail' | 'errors.invalidPassword') => string

function validate(formData: FormData, t: AuthTranslator): ValidationErrors {
  const email = formData.get('email')
  const password = formData.get('password')

  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) {
    return { email: t('errors.invalidEmail') }
  }

  if (typeof password !== 'string' || password.length < 12 || password.length > 64) {
    return { password: t('errors.invalidPassword') }
  }

  return {}
}

export function SignUpForm({ action = signUpAction }: SignUpFormProps) {
  const t = useTranslations('auth')
  const translate = useTranslations()
  const [state, setState] = useState<SignUpActionState>(initialSignUpActionState)
  const [errors, setErrors] = useState<ValidationErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const validationErrors = validate(formData, t)

    setErrors(validationErrors)

    if (validationErrors.email !== undefined || validationErrors.password !== undefined) {
      return
    }

    setIsSubmitting(true)
    const result = await action(state, formData)
    setState(result)
    setIsSubmitting(false)

    if (result.status === 'api-error') {
      showApiErrorToast(result.error, translate)
    }
  }

  if (state.status === 'success') {
    return <p role="status">{t(state.messageKey)}</p>
  }

  return (
    <form
      noValidate
      onSubmit={(event) => {
        void handleSubmit(event)
      }}
    >
      <input name="captchaToken" type="hidden" value="" />
      <div className="grid gap-4">
        <Field
          {...(errors.email === undefined ? {} : { error: errors.email })}
          label={t('signUp.emailLabel')}
        >
          <Input autoComplete="email" name="email" type="email" />
        </Field>
        <Field
          {...(errors.password === undefined ? {} : { error: errors.password })}
          label={t('signUp.passwordLabel')}
        >
          <Input autoComplete="new-password" name="password" type="password" />
        </Field>
        {state.status === 'validation-error' ? <p role="alert">{t(state.messageKey)}</p> : null}
        <Button isLoading={isSubmitting} type="submit">
          {t('signUp.submit')}
        </Button>
      </div>
    </form>
  )
}

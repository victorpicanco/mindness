'use client'

import { useTranslations } from 'next-intl'
import { type FormEvent, useState } from 'react'

import { passwordSchema } from '../password-policy'
import { signUpAction } from './actions'
import { PasswordChecklist } from './password-checklist'
import { initialSignUpActionState, type SignUpActionState } from './types'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
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
  readonly passwordConfirmation?: string
}

type AuthTranslator = (
  key: 'errors.invalidEmail' | 'errors.invalidPassword' | 'errors.passwordMismatch',
) => string

function validate(formData: FormData, t: AuthTranslator): ValidationErrors {
  const email = formData.get('email')
  const password = formData.get('password')
  const passwordConfirmation = formData.get('passwordConfirmation')

  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) {
    return { email: t('errors.invalidEmail') }
  }

  if (typeof password !== 'string' || !passwordSchema.safeParse(password).success) {
    return { password: t('errors.invalidPassword') }
  }

  if (typeof passwordConfirmation !== 'string' || passwordConfirmation !== password) {
    return { passwordConfirmation: t('errors.passwordMismatch') }
  }

  return {}
}

export function SignUpForm({ action = signUpAction }: SignUpFormProps) {
  const t = useTranslations('auth')
  const translate = useTranslations()
  const [state, setState] = useState<SignUpActionState>(initialSignUpActionState)
  const [errors, setErrors] = useState<ValidationErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [password, setPassword] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const validationErrors = validate(formData, t)

    setErrors(validationErrors)

    if (
      validationErrors.email !== undefined ||
      validationErrors.password !== undefined ||
      validationErrors.passwordConfirmation !== undefined
    ) {
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
      className="grid gap-8"
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
          <Input
            autoComplete="email"
            name="email"
            placeholder={t('signIn.emailPlaceholder')}
            type="email"
          />
        </Field>
        <Field
          {...(errors.password === undefined ? {} : { error: errors.password })}
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
          {...(errors.passwordConfirmation === undefined
            ? {}
            : { error: errors.passwordConfirmation })}
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
        {state.status === 'validation-error' ? <p role="alert">{t(state.messageKey)}</p> : null}
        <Button isLoading={isSubmitting} size="lg" type="submit">
          {t('signUp.submit')}
        </Button>
      </div>
    </form>
  )
}

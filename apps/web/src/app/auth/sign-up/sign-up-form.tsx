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
import { Turnstile, TURNSTILE_TOKEN_FIELD_NAME } from '@/components/ui/turnstile'
import { describeApiError } from '@/lib/errors/api-error-presentation'
import { describeApiFieldIssues } from '@/lib/errors/api-field-issues'
import { showApiErrorToast } from '@/lib/errors/show-api-error-toast'

import {
  EMAIL_PATTERN,
  fieldOfActionMessageKey,
  formFieldValue,
  type AuthFormMessageKey,
} from '../form-validation'

export type SignUpFormAction = (
  state: SignUpActionState,
  formData: FormData,
) => Promise<SignUpActionState>

type SignUpFormProps = {
  readonly action?: SignUpFormAction
}

type FieldErrors = {
  readonly captchaToken?: AuthFormMessageKey
  readonly email?: AuthFormMessageKey
  readonly password?: AuthFormMessageKey
  readonly passwordConfirmation?: AuthFormMessageKey
}

function validate(formData: FormData): FieldErrors {
  const errors: { -readonly [Key in keyof FieldErrors]: FieldErrors[Key] } = {}
  const password = formFieldValue(formData, 'password')

  if (!EMAIL_PATTERN.test(formFieldValue(formData, 'email'))) {
    errors.email = 'auth.errors.invalidEmail'
  }

  if (!passwordSchema.safeParse(password).success) {
    errors.password = 'auth.errors.invalidPassword'
  }

  if (formFieldValue(formData, 'passwordConfirmation') !== password) {
    errors.passwordConfirmation = 'auth.errors.passwordMismatch'
  }

  if (formFieldValue(formData, TURNSTILE_TOKEN_FIELD_NAME) === '') {
    errors.captchaToken = 'auth.errors.captchaRequired'
  }

  return errors
}

function hasFieldError(errors: FieldErrors): boolean {
  return Object.values(errors).some((messageKey) => messageKey !== undefined)
}

export function SignUpForm({ action = signUpAction }: SignUpFormProps) {
  const t = useTranslations('auth')
  const translate = useTranslations()
  const [state, setState] = useState<SignUpActionState>(initialSignUpActionState)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [captchaResetSignal, setCaptchaResetSignal] = useState(0)
  const [password, setPassword] = useState('')
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

  const alertMessageKey = ((): AuthFormMessageKey | undefined => {
    if (siteKey === undefined) return 'auth.errors.captchaUnavailable'

    if (state.status !== 'api-error') return undefined

    const description = describeApiError(state.error.code)

    return description.presentation === 'inline' ? description.messageKey : undefined
  })()

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const validationErrors = validate(formData)

    setFieldErrors(validationErrors)

    if (hasFieldError(validationErrors)) return

    setIsSubmitting(true)
    const result = await action(state, formData)

    setState(result)
    setIsSubmitting(false)
    setCaptchaResetSignal((signal) => signal + 1)

    if (result.status === 'validation-error') {
      setFieldErrors({ [fieldOfActionMessageKey(result.messageKey)]: `auth.${result.messageKey}` })
      return
    }

    if (result.status !== 'api-error') return

    setFieldErrors(describeApiFieldIssues(result.error.issues))
    showApiErrorToast(result.error, translate)
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
      <div className="grid gap-4">
        <Field
          {...(fieldErrors.email === undefined ? {} : { error: translate(fieldErrors.email) })}
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
          {...(fieldErrors.password === undefined
            ? {}
            : { error: translate(fieldErrors.password) })}
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
          {...(fieldErrors.passwordConfirmation === undefined
            ? {}
            : { error: translate(fieldErrors.passwordConfirmation) })}
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
          <div className="grid gap-1.5">
            <Turnstile
              onError={() => {
                setFieldErrors((current) => ({
                  ...current,
                  captchaToken: 'auth.errors.captchaUnavailable',
                }))
              }}
              onVerify={() => {
                setFieldErrors((current) => ({
                  ...(current.email === undefined ? {} : { email: current.email }),
                  ...(current.password === undefined ? {} : { password: current.password }),
                  ...(current.passwordConfirmation === undefined
                    ? {}
                    : { passwordConfirmation: current.passwordConfirmation }),
                }))
              }}
              resetSignal={captchaResetSignal}
              siteKey={siteKey}
            />
            {fieldErrors.captchaToken === undefined ? null : (
              <p className="text-sm text-error" role="alert">
                {translate(fieldErrors.captchaToken)}
              </p>
            )}
          </div>
        )}
        {alertMessageKey === undefined ? null : (
          <p className="text-sm text-error" role="alert">
            {translate(alertMessageKey)}
          </p>
        )}
        <Button disabled={siteKey === undefined} isLoading={isSubmitting} size="lg" type="submit">
          {t('signUp.submit')}
        </Button>
      </div>
    </form>
  )
}

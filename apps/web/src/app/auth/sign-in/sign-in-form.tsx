'use client'

import { useTranslations } from 'next-intl'
import { type FormEvent, useState } from 'react'

import { signInAction } from './actions'
import { initialSignInActionState, type SignInActionState } from './types'
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

export type SignInFormAction = (
  state: SignInActionState,
  formData: FormData,
) => Promise<SignInActionState>

type SignInFormProps = {
  readonly action?: SignInFormAction
  readonly initialErrorMessageKey?: AuthFormMessageKey
}

type FieldErrors = {
  readonly captchaToken?: AuthFormMessageKey
  readonly email?: AuthFormMessageKey
  readonly password?: AuthFormMessageKey
}

function googleAuthorizationUrl(): string {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL

  return apiBaseUrl === undefined ? '/auth/google' : `${apiBaseUrl}/auth/google`
}

function validate(formData: FormData): FieldErrors {
  const errors: { -readonly [Key in keyof FieldErrors]: FieldErrors[Key] } = {}

  if (!EMAIL_PATTERN.test(formFieldValue(formData, 'email'))) {
    errors.email = 'auth.errors.invalidEmail'
  }

  if (formFieldValue(formData, 'password') === '') {
    errors.password = 'auth.errors.passwordRequired'
  }

  if (formFieldValue(formData, TURNSTILE_TOKEN_FIELD_NAME) === '') {
    errors.captchaToken = 'auth.errors.captchaRequired'
  }

  return errors
}

function hasFieldError(errors: FieldErrors): boolean {
  return Object.values(errors).some((messageKey) => messageKey !== undefined)
}

export function SignInForm({ action = signInAction, initialErrorMessageKey }: SignInFormProps) {
  const t = useTranslations('auth')
  const translate = useTranslations()
  const [state, setState] = useState<SignInActionState>(initialSignInActionState)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [captchaResetSignal, setCaptchaResetSignal] = useState(0)
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

  const alertMessageKey = ((): AuthFormMessageKey | undefined => {
    if (siteKey === undefined) return 'auth.errors.captchaUnavailable'

    if (state.status === 'api-error') {
      const description = describeApiError(state.error.code)

      return description.presentation === 'inline' ? description.messageKey : undefined
    }

    return state.status === 'idle' ? initialErrorMessageKey : undefined
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

    if (result.status === 'error') {
      setFieldErrors({ [fieldOfActionMessageKey(result.messageKey)]: `auth.${result.messageKey}` })
      return
    }

    if (result.status !== 'api-error') return

    setFieldErrors(describeApiFieldIssues(result.error.issues))
    showApiErrorToast(result.error, translate)
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
        <a
          className="inline-flex min-h-14 items-center justify-center rounded-full border border-border px-6 py-4 text-base font-medium text-text transition-colors hover:border-text-muted hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text"
          href={googleAuthorizationUrl()}
        >
          {t('signIn.google')}
        </a>
        <div className="flex items-center gap-3 text-xs text-text-muted" role="separator">
          <span className="h-px flex-1 bg-divider" />
          {t('signIn.divider')}
          <span className="h-px flex-1 bg-divider" />
        </div>
      </div>
      <div className="grid gap-4">
        <Field
          {...(fieldErrors.email === undefined ? {} : { error: translate(fieldErrors.email) })}
          label={t('signIn.emailLabel')}
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
          label={t('signIn.passwordLabel')}
        >
          <PasswordInput
            autoComplete="current-password"
            hidePasswordLabel={t('password.hide')}
            name="password"
            placeholder={t('signIn.passwordPlaceholder')}
            showPasswordLabel={t('password.show')}
          />
        </Field>
      </div>
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
      <div className="grid gap-4">
        {alertMessageKey === undefined ? null : (
          <p className="text-sm text-error" role="alert">
            {translate(alertMessageKey)}
          </p>
        )}
        <Button
          className="w-full"
          disabled={siteKey === undefined}
          isLoading={isSubmitting}
          size="lg"
          type="submit"
        >
          {t('signIn.submit')}
        </Button>
      </div>
    </form>
  )
}

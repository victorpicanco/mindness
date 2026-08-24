'use client'

import { useTranslations } from 'next-intl'
import { type FormEvent, useState } from 'react'

import { signInAction } from './actions'
import { initialSignInActionState, type SignInActionState } from './types'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { describeApiError } from '@/lib/errors/api-error-presentation'
import { showApiErrorToast } from '@/lib/errors/show-api-error-toast'

export type SignInFormAction = (
  state: SignInActionState,
  formData: FormData,
) => Promise<SignInActionState>

type SignInFormProps = {
  readonly action?: SignInFormAction
}

function googleAuthorizationUrl(): string {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL

  return apiBaseUrl === undefined ? '/auth/google' : `${apiBaseUrl}/auth/google`
}

export function SignInForm({ action = signInAction }: SignInFormProps) {
  const t = useTranslations('auth')
  const translate = useTranslations()
  const [state, setState] = useState<SignInActionState>(initialSignInActionState)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const apiError = state.status === 'api-error' ? describeApiError(state.error.code) : undefined
  const inlineError =
    apiError?.presentation === 'inline' ? translate(apiError.messageKey) : undefined

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setIsSubmitting(true)

    const result = await action(state, new FormData(event.currentTarget))

    setState(result)
    setIsSubmitting(false)

    if (result.status === 'api-error') {
      showApiErrorToast(result.error, translate)
    }
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
        <Field label={t('signIn.emailLabel')}>
          <Input
            autoComplete="email"
            name="email"
            placeholder={t('signIn.emailPlaceholder')}
            type="email"
          />
        </Field>
        <Field label={t('signIn.passwordLabel')}>
          <PasswordInput
            autoComplete="current-password"
            hidePasswordLabel={t('password.hide')}
            name="password"
            placeholder={t('signIn.passwordPlaceholder')}
            showPasswordLabel={t('password.show')}
          />
        </Field>
      </div>
      <input name="captchaToken" type="hidden" value="" />
      <div className="grid gap-4">
        {inlineError === undefined ? null : (
          <p className="text-sm text-error" role="alert">
            {inlineError}
          </p>
        )}
        <Button className="w-full" isLoading={isSubmitting} size="lg" type="submit">
          {t('signIn.submit')}
        </Button>
      </div>
    </form>
  )
}

'use client'

import { useTranslations } from 'next-intl'
import { useActionState, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Turnstile } from '@/components/ui/turnstile'

import type { EmailRequestState } from './auth-flow-actions'

export type EmailRequestServerAction = (
  state: EmailRequestState,
  formData: FormData,
) => Promise<EmailRequestState>

const initialState: EmailRequestState = { status: 'idle' }

export function EmailRequestForm({
  action,
  submitLabel,
  successMessage,
}: {
  readonly action: EmailRequestServerAction
  readonly submitLabel: string
  readonly successMessage: string
}) {
  const t = useTranslations('auth')
  const [state, formAction, pending] = useActionState(action, initialState)
  const [resetSignal, setResetSignal] = useState(0)
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

  return (
    <form
      action={(formData) => {
        formAction(formData)
        setResetSignal((current) => current + 1)
      }}
      className="grid gap-6"
    >
      <Field label={t('signIn.emailLabel')}>
        <Input autoComplete="email" name="email" required type="email" />
      </Field>
      {siteKey === undefined ? (
        <p className="text-sm text-error" role="alert">
          {t('errors.captchaUnavailable')}
        </p>
      ) : (
        <Turnstile resetSignal={resetSignal} siteKey={siteKey} />
      )}
      {state.status === 'success' ? (
        <p className="text-sm text-text-muted" role="status">
          {successMessage}
        </p>
      ) : null}
      {state.status === 'error' ? (
        <p className="text-sm text-error" role="alert">
          {t('errors.requestFailed')}
        </p>
      ) : null}
      <Button disabled={siteKey === undefined} isLoading={pending} size="lg" type="submit">
        {submitLabel}
      </Button>
    </form>
  )
}

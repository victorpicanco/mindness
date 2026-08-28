'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'

import { Turnstile } from '@/components/ui/turnstile'

import type { AuthFormBinding } from '@/components/auth/use-auth-form'

type AuthCaptchaFieldProps = {
  readonly form: AuthFormBinding
  readonly siteKey: string | undefined
}

// Rendered from the binding rather than from five separate props: every auth form wires the widget
// the same way, and the form is the only thing that knows the token, the reset and the error.
export function AuthCaptchaField({ form, siteKey }: AuthCaptchaFieldProps) {
  const translate = useTranslations()
  const [widgetFailed, setWidgetFailed] = useState(false)
  const errorKey = widgetFailed ? 'auth.errors.captchaUnavailable' : form.fieldErrors.captchaToken

  if (siteKey === undefined) return null

  return (
    <div className="grid gap-1.5">
      <Turnstile
        onError={() => setWidgetFailed(true)}
        onTokenChange={(token) => {
          if (token !== '') setWidgetFailed(false)
        }}
        resetSignal={form.captchaResetSignal}
        siteKey={siteKey}
      />
      {errorKey === undefined ? null : (
        <p className="text-sm text-error" role="alert">
          {translate(errorKey)}
        </p>
      )}
    </div>
  )
}

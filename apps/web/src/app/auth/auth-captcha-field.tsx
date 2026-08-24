'use client'

import { useTranslations } from 'next-intl'

import { Turnstile } from '@/components/ui/turnstile'

import type { AuthFormMessageKey } from './form-validation'

type AuthCaptchaFieldProps = {
  readonly errorMessageKey?: AuthFormMessageKey
  readonly onError: () => void
  readonly onTokenChange: (token: string) => void
  readonly resetSignal: number
  readonly siteKey: string
}

export function AuthCaptchaField({
  errorMessageKey,
  onError,
  onTokenChange,
  resetSignal,
  siteKey,
}: AuthCaptchaFieldProps) {
  const translate = useTranslations()

  return (
    <div className="grid gap-1.5">
      <Turnstile
        onError={onError}
        onTokenChange={onTokenChange}
        resetSignal={resetSignal}
        siteKey={siteKey}
      />
      {errorMessageKey === undefined ? null : (
        <p className="text-sm text-error" role="alert">
          {translate(errorMessageKey)}
        </p>
      )}
    </div>
  )
}

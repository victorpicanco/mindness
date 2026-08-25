'use client'

import { useTranslations } from 'next-intl'

import type { AuthFormMessageKey } from '@/lib/auth/form-validation'

export function AuthFormAlert({ messageKey }: { readonly messageKey?: AuthFormMessageKey }) {
  const translate = useTranslations()

  if (messageKey === undefined) return null

  return (
    <p className="text-sm text-error" role="alert">
      {translate(messageKey)}
    </p>
  )
}

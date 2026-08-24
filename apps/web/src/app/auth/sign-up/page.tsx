'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useCallback, useState } from 'react'

import { AuthPageShell } from '../auth-page-shell'
import { SignUpForm } from './sign-up-form'

export default function SignUpPage() {
  const t = useTranslations('auth.signUp')
  const [hasSucceeded, setHasSucceeded] = useState(false)
  const handleSuccess = useCallback(() => {
    setHasSucceeded(true)
  }, [])

  return (
    <AuthPageShell description={t('description')} title={hasSucceeded ? t('success') : t('title')}>
      <SignUpForm onSuccess={handleSuccess} />
      <p className="text-center text-sm text-text-muted">
        {t('accountPrompt')}{' '}
        <Link
          className="font-medium text-text underline-offset-2 hover:underline"
          href="/auth/sign-in"
        >
          {t('accountLink')}
        </Link>
      </p>
    </AuthPageShell>
  )
}

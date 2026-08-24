import Link from 'next/link'
import { useTranslations } from 'next-intl'

import type { ApiErrorDescription } from '@/lib/errors/api-error-presentation'

import { AuthPageShell } from '../auth-page-shell'
import { SignInForm } from './sign-in-form'

type SignInScreenProps = {
  readonly initialError?: ApiErrorDescription
  readonly passwordUpdated?: boolean
  readonly redirectTo?: string
}

export function SignInScreen({
  initialError,
  passwordUpdated = false,
  redirectTo,
}: SignInScreenProps) {
  const t = useTranslations('auth.signIn')

  return (
    <AuthPageShell description={t('description')} title={t('title')}>
      <SignInForm
        {...(initialError === undefined ? {} : { initialError })}
        {...(redirectTo === undefined ? {} : { redirectTo })}
      />
      {passwordUpdated ? (
        <p className="text-center text-sm text-text-muted" role="status">
          {t('passwordUpdated')}
        </p>
      ) : null}
      <p className="text-center text-sm text-text-muted">
        {t('accountPrompt')}{' '}
        <Link
          className="font-medium text-text underline-offset-2 hover:underline"
          href="/auth/sign-up"
        >
          {t('accountLink')}
        </Link>
      </p>
    </AuthPageShell>
  )
}

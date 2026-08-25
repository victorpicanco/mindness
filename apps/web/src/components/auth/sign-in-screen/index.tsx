import Link from 'next/link'
import { useTranslations } from 'next-intl'

import { AuthPageShell } from '@/components/auth/page-shell'
import { SignInForm } from '@/components/auth/sign-in-form'
import type { AuthFormAction } from '@/components/auth/use-auth-form'
import type { ApiErrorDescription } from '@/lib/errors/api-error-presentation'

type SignInScreenProps = {
  readonly action: AuthFormAction
  readonly initialError?: ApiErrorDescription
  readonly passwordUpdated?: boolean
  readonly redirectTo?: string
}

export function SignInScreen({
  action,
  initialError,
  passwordUpdated = false,
  redirectTo,
}: SignInScreenProps) {
  const t = useTranslations('auth.signIn')

  return (
    <AuthPageShell description={t('description')} title={t('title')}>
      <SignInForm
        action={action}
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

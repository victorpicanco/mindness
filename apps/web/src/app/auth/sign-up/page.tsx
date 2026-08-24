import Link from 'next/link'
import { useTranslations } from 'next-intl'

import { AuthPageShell } from '../auth-page-shell'
import { SignUpForm } from './sign-up-form'

export default function SignUpPage() {
  const t = useTranslations('auth.signUp')

  return (
    <AuthPageShell description={t('description')} title={t('title')}>
      <SignUpForm />
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

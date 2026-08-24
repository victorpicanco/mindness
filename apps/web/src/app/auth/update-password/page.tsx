import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

import { AuthPageShell } from '../auth-page-shell'
import { UpdatePasswordForm } from './update-password-form'

export default async function UpdatePasswordPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly status?: string }>
}) {
  const t = await getTranslations('auth.updatePassword')
  const invalid = (await searchParams).status === 'invalid'
  return (
    <AuthPageShell description={t('description')} title={t('title')}>
      {invalid ? (
        <>
          <p className="text-sm text-error" role="alert">
            {t('invalid')}
          </p>
          <Link className="text-center text-sm underline" href="/auth/password-recovery">
            {t('requestAgain')}
          </Link>
        </>
      ) : (
        <UpdatePasswordForm />
      )}
    </AuthPageShell>
  )
}

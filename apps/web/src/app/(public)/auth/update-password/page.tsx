import { cookies } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'

import { AuthPageShell } from '@/components/auth/page-shell'
import { UpdatePasswordForm } from '@/components/auth/update-password-form'
import { createRequireSession } from '@/lib/auth/require-session'

import { updatePasswordAction } from './actions'

export default async function UpdatePasswordPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly status?: string }>
}) {
  const t = await getTranslations('auth.updatePassword')
  const invalid = (await searchParams).status === 'invalid'

  if (!invalid) createRequireSession({ cookieStore: await cookies(), redirect })()

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
        <UpdatePasswordForm action={updatePasswordAction} />
      )}
    </AuthPageShell>
  )
}

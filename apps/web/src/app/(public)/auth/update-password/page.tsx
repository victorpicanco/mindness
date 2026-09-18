import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'

import { ExpiredRecoveryLink } from '@/components/auth/expired-recovery-link'
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
      {invalid ? <ExpiredRecoveryLink /> : <UpdatePasswordForm action={updatePasswordAction} />}
    </AuthPageShell>
  )
}

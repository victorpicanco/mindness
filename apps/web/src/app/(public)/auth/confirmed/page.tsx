import Link from 'next/link'
import { useTranslations } from 'next-intl'

import { AuthPageShell } from '@/components/auth/page-shell'
import { buttonStyles } from '@/components/ui/button'

type ConfirmationStatus = 'success' | 'invalid'

export function ConfirmedScreen({ status }: { readonly status: ConfirmationStatus }) {
  const t = useTranslations('auth.confirmed')
  const isConfirmed = status === 'success'

  return (
    <AuthPageShell
      description={t(isConfirmed ? 'description' : 'invalidDescription')}
      title={t(isConfirmed ? 'title' : 'invalidTitle')}
    >
      <Link
        className={buttonStyles({ size: 'lg' })}
        href={isConfirmed ? '/auth/sign-in' : '/auth/resend-confirmation'}
      >
        {t(isConfirmed ? 'signInLink' : 'resendLink')}
      </Link>
    </AuthPageShell>
  )
}

export default async function ConfirmedPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly status?: string }>
}) {
  const { status } = await searchParams

  return <ConfirmedScreen status={status === 'success' ? 'success' : 'invalid'} />
}

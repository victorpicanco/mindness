import Link from 'next/link'
import { useTranslations } from 'next-intl'

import { AuthPageShell } from '../auth-page-shell'

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
        className="inline-flex min-h-14 items-center justify-center rounded-full bg-text px-6 py-4 text-base font-medium text-surface transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text"
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

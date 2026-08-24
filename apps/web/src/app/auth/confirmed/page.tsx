import Image from 'next/image'
import { Buenard } from 'next/font/google'
import Link from 'next/link'
import { useTranslations } from 'next-intl'

import { SignInShowcase } from '@/app/auth/sign-in/sign-in-showcase'

const buenard = Buenard({
  display: 'swap',
  subsets: ['latin'],
  variable: '--font-buenard',
  weight: ['400', '700'],
})

type ConfirmationStatus = 'success' | 'invalid'

export function ConfirmedScreen({ status }: { readonly status: ConfirmationStatus }) {
  const t = useTranslations('auth.confirmed')
  const commonT = useTranslations('common')

  return (
    <main className="min-h-screen bg-surface text-text lg:grid lg:grid-cols-2">
      <section
        className={`${buenard.variable} flex min-h-screen items-center justify-center px-6 py-16 sm:px-10`}
      >
        <div className="grid w-full max-w-sm gap-8">
          <div className="flex items-center gap-2">
            <Image alt="" height={32} src="/logo-icon.svg" width={32} />
            <span className="font-(family-name:--font-buenard) text-2xl">
              {commonT('metadata.title')}
            </span>
          </div>
          <div className="grid gap-2">
            <h1 className="font-(family-name:--font-buenard) text-3xl leading-tight tracking-tight">
              {t(status === 'success' ? 'title' : 'invalidTitle')}
            </h1>
            <p className="text-sm text-text-muted">
              {t(status === 'success' ? 'description' : 'invalidDescription')}
            </p>
          </div>
          <Link
            className="inline-flex min-h-14 items-center justify-center rounded-full bg-text px-6 py-4 text-base font-medium text-surface transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text"
            href={status === 'success' ? '/auth/sign-in' : '/auth/resend-confirmation'}
          >
            {t(status === 'success' ? 'signInLink' : 'resendLink')}
          </Link>
        </div>
      </section>
      <aside className="hidden lg:block">
        <SignInShowcase />
      </aside>
    </main>
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

import Image from 'next/image'
import { Buenard } from 'next/font/google'
import Link from 'next/link'
import { useTranslations } from 'next-intl'

import { SignInForm } from './sign-in-form'
import { SignInShowcase } from './sign-in-showcase'

const buenard = Buenard({
  display: 'swap',
  subsets: ['latin'],
  variable: '--font-buenard',
  weight: ['400', '700'],
})

export default function SignInPage() {
  const t = useTranslations('auth.signIn')
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
              {t('title')}
            </h1>
            <p className="text-sm text-text-muted">{t('description')}</p>
          </div>
          <SignInForm />
          <p className="text-center text-sm text-text-muted">
            {t('accountPrompt')}{' '}
            <Link
              className="font-medium text-text underline-offset-2 hover:underline"
              href="/auth/sign-up"
            >
              {t('accountLink')}
            </Link>
          </p>
        </div>
      </section>
      <aside className="hidden lg:block">
        <SignInShowcase />
      </aside>
    </main>
  )
}

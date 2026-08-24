import Image from 'next/image'
import { Buenard } from 'next/font/google'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import type { ReactNode } from 'react'

import { SignInShowcase } from '@/app/auth/sign-in/sign-in-showcase'

const buenard = Buenard({
  display: 'swap',
  subsets: ['latin'],
  variable: '--font-buenard',
  weight: ['400', '700'],
})

export function AuthPageShell({
  title,
  description,
  children,
}: {
  readonly title: string
  readonly description: string
  readonly children: ReactNode
}) {
  const commonT = useTranslations('common')
  return (
    <main className="min-h-screen bg-surface text-text lg:grid lg:grid-cols-2">
      <section
        className={`${buenard.variable} flex min-h-screen items-center justify-center px-6 py-16 sm:px-10`}
      >
        <div className="grid w-full max-w-sm gap-8">
          <Link className="flex items-center gap-2" href="/">
            <Image alt="" height={32} src="/logo-icon.svg" width={32} />
            <span className="font-(family-name:--font-buenard) text-2xl">
              {commonT('metadata.title')}
            </span>
          </Link>
          <div className="grid gap-2">
            <h1 className="font-(family-name:--font-buenard) text-3xl leading-tight tracking-tight">
              {title}
            </h1>
            <p className="text-sm text-text-muted">{description}</p>
          </div>
          {children}
        </div>
      </section>
      <aside className="hidden lg:block">
        <SignInShowcase />
      </aside>
    </main>
  )
}

'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'

export default function NotFound() {
  const t = useTranslations('common.notFound')

  return (
    <main className="grid min-h-screen place-items-center bg-surface px-6 text-text">
      <div className="flex max-w-md flex-col items-center gap-5 text-center">
        <div>
          <h1 className="text-2xl font-semibold">{t('title')}</h1>
          <p className="mt-2 text-text-muted">{t('description')}</p>
        </div>
        <Link
          className="inline-flex min-h-10 items-center justify-center rounded-full bg-text px-4 text-sm font-medium text-surface hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text"
          href="/"
        >
          {t('home')}
        </Link>
      </div>
    </main>
  )
}

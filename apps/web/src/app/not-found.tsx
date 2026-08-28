import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

import { buttonStyles } from '@/components/ui/button'
export default async function NotFound() {
  const t = await getTranslations('common.notFound')

  return (
    <main className="grid min-h-screen place-items-center bg-surface px-6 text-text">
      <div className="flex max-w-md flex-col items-center gap-5 text-center">
        <div>
          <h1 className="text-2xl font-semibold">{t('title')}</h1>
          <p className="mt-2 text-text-muted">{t('description')}</p>
        </div>
        <Link className={buttonStyles()} href="/">
          {t('home')}
        </Link>
      </div>
    </main>
  )
}

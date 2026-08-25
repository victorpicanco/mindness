'use client'

import { useTranslations } from 'next-intl'
import { useEffect } from 'react'

import { Button } from '@/components/ui/button'

interface ErrorBoundaryProps {
  readonly error: Error & { readonly digest?: string }
  readonly reset: () => void
}

export default function ErrorBoundary({ error, reset }: ErrorBoundaryProps) {
  const t = useTranslations('common.routeError')

  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="grid min-h-screen place-items-center bg-surface px-6 text-text">
      <div className="flex max-w-md flex-col items-center gap-5 text-center" role="alert">
        <div>
          <h1 className="text-2xl font-semibold">{t('title')}</h1>
          <p className="mt-2 text-text-muted">{t('description')}</p>
        </div>
        <Button onClick={reset}>{t('retry')}</Button>
      </div>
    </main>
  )
}

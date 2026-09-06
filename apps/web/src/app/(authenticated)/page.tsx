import { cacheLife } from 'next/cache'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'

import { categoriesSchema } from '@/lib/api/contracts/sessions'
import { getActiveSession } from '@/lib/api/authenticated-session-data'
import { apiFetch } from '@/lib/api/server-client'
import { signOutAction } from '@/lib/auth/sign-out'
import { sessionPath } from '@/lib/navigation/session-routes'

import { PracticeConfigFormWithNavigation } from '@/components/practice/config-form'
async function readThemeCategories() {
  'use cache: private'
  cacheLife('hours')

  return apiFetch('/sessions/theme-categories', { schema: categoriesSchema })
}

export default async function HomePage() {
  const [t, categories, activeSession] = await Promise.all([
    getTranslations('home.practice'),
    readThemeCategories(),
    getActiveSession(),
  ])

  if (activeSession !== null) redirect(sessionPath(activeSession.sessionId))

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-surface px-6 py-10">
      <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 items-center justify-between gap-6">
        <div className="flex size-full min-h-0 flex-col items-center justify-center px-6 py-12 sm:px-10">
          <h1 className="font-(family-name:--font-buenard) text-center text-3xl leading-tight tracking-tight sm:text-4xl">
            {t('title')}
          </h1>
          <PracticeConfigFormWithNavigation categories={categories} signOut={signOutAction} />
        </div>
      </div>
    </div>
  )
}

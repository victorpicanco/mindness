import { cacheLife } from 'next/cache'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'

import { categoriesSchema } from '@/lib/api/contracts/sessions'
import {
  getAccountProfileIfAuthenticated,
  getActiveSessionIfAuthenticated,
} from '@/lib/api/authenticated-session-data'
import { publicApiFetch } from '@/lib/api/server-client'
import { hasUsedGuestTrial } from '@/lib/auth/guest-trial'
import { signOutAction } from '@/lib/auth/sign-out'
import { signInAction, signUpAction } from '@/lib/auth/authentication-actions'
import { describeSignInRedirectError } from '@/lib/auth/sign-in-redirect-error'
import { sessionPath } from '@/lib/navigation/session-routes'

import { PracticeConfigFormWithNavigation } from '@/components/practice/config-form'

export const instant = false

type HomePageProps = {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>
}

async function readThemeCategories() {
  'use cache'
  cacheLife('hours')

  return publicApiFetch('/sessions/theme-categories', { schema: categoriesSchema })
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const cookieStore = await cookies()
  const [t, categories, accountProfile, activeSession, params] = await Promise.all([
    getTranslations('home.practice'),
    readThemeCategories(),
    getAccountProfileIfAuthenticated(),
    getActiveSessionIfAuthenticated(),
    searchParams,
  ])

  if (activeSession !== null) redirect(sessionPath(activeSession.sessionId))

  const initialAuthenticationError = describeSignInRedirectError(params.error)
  const passwordUpdated = params.status === 'password-updated'
  const initialAuthenticationMode =
    initialAuthenticationError !== undefined || passwordUpdated ? 'sign-in' : null

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-surface px-6 py-10">
      <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 items-center justify-between gap-6">
        <div className="flex size-full min-h-0 flex-col items-center justify-center px-6 py-12 sm:px-10">
          <h1 className="font-(family-name:--font-buenard) text-center text-3xl leading-tight tracking-tight sm:text-4xl">
            {t('title')}
          </h1>
          <PracticeConfigFormWithNavigation
            categories={categories}
            initialAuthenticationError={initialAuthenticationError}
            initialAuthenticationMode={initialAuthenticationMode}
            isTrialConsumed={hasUsedGuestTrial(cookieStore)}
            passwordUpdated={passwordUpdated}
            signInAction={signInAction}
            signOut={signOutAction}
            signUpAction={signUpAction}
            viewer={accountProfile?.accountKind ?? 'visitor'}
          />
        </div>
      </div>
    </div>
  )
}

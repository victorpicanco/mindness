import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'

import { activeSessionSchema, categoriesSchema, quotaSchema } from '@/lib/api/contracts/sessions'
import { apiFetch } from '@/lib/api/server-client'
import { signOutAction } from '@/lib/auth/sign-out'
import { sessionPath } from '@/lib/navigation/session-routes'
import { PracticeSessionProvider } from '@/stores/practice-session/provider'

import type { PracticeQuota } from '@/components/practice/config-form'
import { PracticeSessionStart } from '@/components/practice/session-start'

type ApiFetch = typeof apiFetch
type PracticeTranslationKey = 'activeSession' | 'title'
type PracticeTranslations = (key: PracticeTranslationKey) => string

async function getPracticeTranslations(): Promise<PracticeTranslations> {
  const t = await getTranslations('home.practice')

  return (key) => t(key)
}

function sessionQuotaSummary(quota: ReturnType<typeof quotaSchema.parse>): PracticeQuota | null {
  if (!quota.enforced) return null

  return {
    allowance: quota.allowance,
    renewsAt: quota.renewsAt,
  }
}

export function createHomePage(
  fetchFromApi: ApiFetch,
  loadPracticeTranslations: () => Promise<PracticeTranslations> = getPracticeTranslations,
  openActiveSession: (path: string) => never = redirect,
) {
  return async function HomePage() {
    const [t, quota, categories, activeSession] = await Promise.all([
      loadPracticeTranslations(),
      fetchFromApi('/sessions/quota', { cache: 'no-store', schema: quotaSchema }),
      fetchFromApi('/sessions/theme-categories', { cache: 'no-store', schema: categoriesSchema }),
      fetchFromApi('/sessions/active', { cache: 'no-store', schema: activeSessionSchema }),
    ])
    if (activeSession !== null) openActiveSession(sessionPath(activeSession.sessionId))
    const summary = sessionQuotaSummary(quota)

    return (
      <PracticeSessionProvider>
        <div className="flex min-h-0 flex-1 flex-col bg-surface px-6 py-10">
          <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 items-center justify-between gap-6">
            <div className="flex size-full min-h-0 flex-col items-center justify-center px-6 py-12 sm:px-10">
              <h1 className="font-(family-name:--font-buenard) text-center text-3xl leading-tight tracking-tight sm:text-4xl">
                {t('title')}
              </h1>
              <PracticeSessionStart
                categories={categories}
                quota={summary}
                signOut={signOutAction}
              />
            </div>
          </div>
        </div>
      </PracticeSessionProvider>
    )
  }
}

const HomePageContent = createHomePage(apiFetch)

export default HomePageContent

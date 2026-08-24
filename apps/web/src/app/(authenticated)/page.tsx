import { cookies } from 'next/headers'
import { getTranslations } from 'next-intl/server'
import { z } from 'zod'

import { AuthenticatedShell } from '@/components/layouts/authenticated-shell'
import { SessionQuota } from '@/components/layouts/session-quota'
import type { SessionQuotaProps } from '@/components/layouts/session-quota'
import { apiFetch } from '@/lib/api/server-client'
import { PracticeSessionProvider } from '@/stores/practice-session/provider'
import type { PracticeSessionInitialState } from '@/stores/practice-session/store'

import { PracticeConfigForm, type PracticeQuota } from './practice-config-form'

const SIDEBAR_PREFERENCE_COOKIE_NAME = 'mindness-sidebar-expanded'

const categoriesSchema = z.array(
  z.object({
    categoryId: z.uuid(),
    name: z.string(),
    slug: z.string(),
  }),
)

const quotaSchema = z.discriminatedUnion('enforced', [
  z.object({
    allowance: z.number().nonnegative(),
    enforced: z.literal(true),
    remaining: z.number().nonnegative(),
    renewsAt: z.iso.datetime(),
  }),
  z.object({ enforced: z.literal(false) }),
])

const activeSessionSchema = z
  .object({
    configuration: z.object({
      categorySlug: z.string(),
      difficulty: z.enum(['easy', 'balanced', 'hard']),
      searchWindowMinutes: z.union([z.literal(3), z.literal(4), z.literal(5)]),
    }),
    createdAt: z.iso.datetime(),
    expiresAt: z.iso.datetime(),
    sessionId: z.uuid(),
    themeId: z.uuid(),
    themeTitle: z.string(),
  })
  .nullable()

type ApiFetch = typeof apiFetch
type PracticeTranslationKey = 'activeSession' | 'title'
type PracticeTranslations = (key: PracticeTranslationKey) => string

async function getPracticeTranslations(): Promise<PracticeTranslations> {
  const t = await getTranslations('home.practice')

  return (key) => t(key)
}

function sessionQuotaSummary(quota: z.output<typeof quotaSchema>): SessionQuotaProps | null {
  if (!quota.enforced) return null

  return {
    allowance: quota.allowance,
    remaining: quota.remaining,
    renewsAt: quota.renewsAt,
  }
}

function initialPracticeSession(
  activeSession: z.output<typeof activeSessionSchema>,
): PracticeSessionInitialState | undefined {
  if (activeSession === null) return undefined

  return {
    session: {
      expiresAt: activeSession.expiresAt,
      sessionId: activeSession.sessionId,
      themeTitle: activeSession.themeTitle,
    },
    status: 'researching',
  }
}

interface HomePageContentProps {
  readonly quota: PracticeQuota | null
}

export function createHomePage(
  fetchFromApi: ApiFetch,
  loadPracticeTranslations: () => Promise<PracticeTranslations> = getPracticeTranslations,
) {
  return async function HomePage({ quota }: HomePageContentProps) {
    const [t, categories, activeSession] = await Promise.all([
      loadPracticeTranslations(),
      fetchFromApi('/sessions/theme-categories', { cache: 'no-store', schema: categoriesSchema }),
      fetchFromApi('/sessions/active', { cache: 'no-store', schema: activeSessionSchema }),
    ])
    const initialState = initialPracticeSession(activeSession)

    return (
      <PracticeSessionProvider {...(initialState === undefined ? {} : { initialState })}>
        <div className="flex min-h-0 flex-1 flex-col bg-surface px-6 py-10">
          <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 items-center justify-between gap-6">
            <div className="flex size-full flex-col items-center justify-center px-6 py-12 sm:px-10">
              {activeSession === null ? (
                <>
                  <h1 className="font-(family-name:--font-buenard) text-center text-3xl leading-tight tracking-tight sm:text-4xl">
                    {t('title')}
                  </h1>
                  <PracticeConfigForm categories={categories} quota={quota} />
                </>
              ) : (
                <section aria-labelledby="active-session-title" className="text-center">
                  <p className="text-text-muted" id="active-session-title">
                    {t('activeSession')}
                  </p>
                  <h1 className="font-(family-name:--font-buenard) mt-2 text-3xl leading-tight tracking-tight sm:text-4xl">
                    {activeSession.themeTitle}
                  </h1>
                </section>
              )}
            </div>
          </div>
        </div>
      </PracticeSessionProvider>
    )
  }
}

const HomePageContent = createHomePage(apiFetch)

export default async function HomePage() {
  const [cookieStore, quota] = await Promise.all([
    cookies(),
    apiFetch('/sessions/quota', { cache: 'no-store', schema: quotaSchema }),
  ])
  const isSidebarExpanded = cookieStore.get(SIDEBAR_PREFERENCE_COOKIE_NAME)?.value !== 'false'
  const summary = sessionQuotaSummary(quota)

  return (
    <AuthenticatedShell
      initialIsExpanded={isSidebarExpanded}
      preferenceCookieName={SIDEBAR_PREFERENCE_COOKIE_NAME}
      {...(summary === null
        ? {}
        : {
            header: (
              <SessionQuota
                allowance={summary.allowance}
                remaining={summary.remaining}
                renewsAt={summary.renewsAt}
              />
            ),
          })}
    >
      <HomePageContent quota={summary} />
    </AuthenticatedShell>
  )
}

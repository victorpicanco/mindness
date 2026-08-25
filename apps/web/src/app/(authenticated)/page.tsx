import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { z } from 'zod'

import { apiFetch } from '@/lib/api/server-client'
import { PracticeSessionProvider } from '@/stores/practice-session/provider'

import type { PracticeQuota } from './practice-config-form'
import { PracticeSessionStart } from './practice-session-start'

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

function sessionQuotaSummary(quota: z.output<typeof quotaSchema>): PracticeQuota | null {
  if (!quota.enforced) return null

  return {
    allowance: quota.allowance,
    renewsAt: quota.renewsAt,
  }
}

interface HomePageContentProps {
  readonly quota: PracticeQuota | null
}

export function createHomePage(
  fetchFromApi: ApiFetch,
  loadPracticeTranslations: () => Promise<PracticeTranslations> = getPracticeTranslations,
  openActiveSession: (path: string) => never = redirect,
) {
  return async function HomePage({ quota }: HomePageContentProps) {
    const [t, categories, activeSession] = await Promise.all([
      loadPracticeTranslations(),
      fetchFromApi('/sessions/theme-categories', { cache: 'no-store', schema: categoriesSchema }),
      fetchFromApi('/sessions/active', { cache: 'no-store', schema: activeSessionSchema }),
    ])
    if (activeSession !== null) openActiveSession(`/${activeSession.sessionId}`)

    return (
      <PracticeSessionProvider>
        <div className="flex min-h-0 flex-1 flex-col bg-surface px-6 py-10">
          <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 items-center justify-between gap-6">
            <div className="flex size-full flex-col items-center justify-center px-6 py-12 sm:px-10">
              <h1 className="font-(family-name:--font-buenard) text-center text-3xl leading-tight tracking-tight sm:text-4xl">
                {t('title')}
              </h1>
              <PracticeSessionStart categories={categories} quota={quota} />
            </div>
          </div>
        </div>
      </PracticeSessionProvider>
    )
  }
}

const HomePageContent = createHomePage(apiFetch)

export default async function HomePage() {
  const quota = await apiFetch('/sessions/quota', { cache: 'no-store', schema: quotaSchema })
  const summary = sessionQuotaSummary(quota)

  return <HomePageContent quota={summary} />
}

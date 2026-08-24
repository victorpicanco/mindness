import { getTranslations } from 'next-intl/server'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { apiFetch } from '@/lib/api/server-client'
import { PracticeSessionProvider } from '@/stores/practice-session/provider'
import type { PracticeSessionInitialState } from '@/stores/practice-session/store'

const categoriesSchema = z.array(
  z.object({
    categoryId: z.uuid(),
    name: z.string(),
    slug: z.string(),
  }),
)

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
type PracticeTranslationKey =
  | 'activeSession'
  | 'categoryLabel'
  | 'categoryPlaceholder'
  | 'difficultyLabel'
  | 'difficultyPlaceholder'
  | 'searchWindowLabel'
  | 'searchWindowPlaceholder'
  | 'startSession'
  | 'title'
type PracticeTranslations = (key: PracticeTranslationKey) => string

async function getPracticeTranslations(): Promise<PracticeTranslations> {
  const t = await getTranslations('home.practice')

  return (key) => t(key)
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

export function createHomePage(
  fetchFromApi: ApiFetch,
  loadPracticeTranslations: () => Promise<PracticeTranslations> = getPracticeTranslations,
) {
  return async function HomePage() {
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
                  <div className="mt-8 flex w-full max-w-4xl flex-col gap-4 sm:flex-row sm:items-center">
                    <Select aria-label={t('difficultyLabel')} disabled>
                      <option>{t('difficultyPlaceholder')}</option>
                    </Select>
                    <Select aria-label={t('categoryLabel')} disabled>
                      <option>{t('categoryPlaceholder')}</option>
                      {categories.map((category) => (
                        <option key={category.categoryId} value={category.slug}>
                          {category.name}
                        </option>
                      ))}
                    </Select>
                    <Select aria-label={t('searchWindowLabel')} disabled>
                      <option>{t('searchWindowPlaceholder')}</option>
                    </Select>
                    <Button className="w-full shrink-0 sm:w-auto" disabled type="button">
                      {t('startSession')}
                    </Button>
                  </div>
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

export default createHomePage(apiFetch)

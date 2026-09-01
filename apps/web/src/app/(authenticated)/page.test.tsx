import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime'
import { NextIntlClientProvider } from 'next-intl'
import type { ReactElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { z } from 'zod'

import { messages } from '@/i18n/messages'
import { PracticeSessionProvider } from '@/stores/practice-session/provider'

const categories = [
  { categoryId: '7d5f46c9-3cbd-4c6d-84aa-66b8148a91aa', name: 'Foco', slug: 'focus' },
]

const requestedPaths: string[] = []
const redirects: string[] = []
let activeSession: unknown = null

const PRACTICE_TRANSLATIONS: Readonly<Record<string, string>> = {
  categoryLabel: 'Categoria',
  categoryPlaceholder: 'Escolha a categoria',
  difficultyLabel: 'Dificuldade',
  difficultyPlaceholder: 'Escolha a dificuldade',
  searchWindowLabel: 'Tempo de pesquisa',
  searchWindowPlaceholder: 'Escolha o tempo',
  startSession: 'Iniciar sessão',
  title: 'Qual será o assunto de hoje?',
}

vi.mock('next/cache', () => ({ cacheLife: () => undefined }))

// Vitest cannot execute next-intl's async server translation API in jsdom.
vi.mock('next-intl/server', () => ({
  getTranslations: () => Promise.resolve((key: string) => PRACTICE_TRANSLATIONS[key] ?? ''),
}))

vi.mock('next/navigation', () => ({
  redirect: (path: string) => {
    redirects.push(path)

    throw new DOMException('Redirected', 'RedirectError')
  },
  useRouter: () => ({
    back: () => undefined,
    forward: () => undefined,
    prefetch: () => undefined,
    push: () => undefined,
    refresh: () => undefined,
    replace: () => undefined,
  }),
}))

vi.mock('@/lib/api/server-client', () => ({
  apiFetch: <TSchema extends z.ZodType>(path: string, options: { readonly schema: TSchema }) => {
    requestedPaths.push(path)
    const response = path === '/sessions/theme-categories' ? categories : activeSession

    return Promise.resolve(options.schema.parse(response))
  },
}))

function renderPage(page: ReactElement) {
  const router = {
    back: () => undefined,
    forward: () => undefined,
    prefetch: () => undefined,
    push: () => undefined,
    refresh: () => undefined,
    replace: () => undefined,
  }

  return render(
    <AppRouterContext.Provider value={router}>
      <QueryClientProvider client={new QueryClient()}>
        <NextIntlClientProvider locale="pt-BR" messages={messages}>
          <PracticeSessionProvider>{page}</PracticeSessionProvider>
        </NextIntlClientProvider>
      </QueryClientProvider>
    </AppRouterContext.Provider>,
  )
}

async function loadHomePage() {
  return (await import('./page')).default
}

describe('HomePage', () => {
  beforeEach(() => {
    requestedPaths.length = 0
    redirects.length = 0
    activeSession = null
  })

  afterEach(cleanup)

  it('starts the categories and active-session requests in one render pass', async () => {
    const HomePage = await loadHomePage()
    const rendered = HomePage()

    expect(requestedPaths).toEqual(['/sessions/theme-categories', '/sessions/active'])

    await rendered
  })

  it('shows the available categories', async () => {
    const HomePage = await loadHomePage()

    renderPage(await HomePage())

    expect(screen.getByRole('heading', { name: 'Qual será o assunto de hoje?' })).toHaveClass(
      'font-(family-name:--font-buenard)',
    )
    expect(screen.getByRole('option', { name: 'Foco' })).toBeInTheDocument()
  })

  it('redirects an active session from the creation route to its canonical URL', async () => {
    activeSession = {
      configuration: { categorySlug: 'focus', difficulty: 'balanced', searchWindowMinutes: 4 },
      createdAt: '2026-08-24T11:50:00.000Z',
      expiresAt: '2026-08-24T12:05:00.000Z',
      recordingStartedAt: null,
      researchEndsAt: '2026-08-24T12:03:00.000Z',
      serverNow: '2026-08-24T12:00:00.000Z',
      sessionId: '7d5f46c9-3cbd-4c6d-84aa-66b8148a91aa',
      themeId: '7d5f46c9-3cbd-4c6d-84aa-66b8148a91ab',
      themeTitle: 'Comunicação clara',
    }

    const HomePage = await loadHomePage()

    await expect(HomePage()).rejects.toMatchObject({ name: 'RedirectError' })
    expect(redirects).toEqual(['/sessions/7d5f46c9-3cbd-4c6d-84aa-66b8148a91aa'])
  })
})

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime'
import { NextIntlClientProvider } from 'next-intl'
import type { ReactElement } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import type { z } from 'zod'

import { messages } from '@/i18n/messages'
import type { apiFetch } from '@/lib/api/server-client'
import { PracticeSessionProvider } from '@/stores/practice-session/provider'

import { createHomePage } from './page'

const categories = [
  { categoryId: '7d5f46c9-3cbd-4c6d-84aa-66b8148a91aa', name: 'Foco', slug: 'focus' },
]

function practiceTranslations(key: string): string {
  const translations: Readonly<Record<string, string>> = {
    categoryLabel: 'Categoria',
    categoryPlaceholder: 'Escolha a categoria',
    difficultyLabel: 'Dificuldade',
    difficultyPlaceholder: 'Escolha a dificuldade',
    searchWindowLabel: 'Tempo de pesquisa',
    searchWindowPlaceholder: 'Escolha o tempo',
    startSession: 'Iniciar sessão',
    title: 'Qual será o assunto de hoje?',
  }

  return translations[key] ?? ''
}

function createApiFetch(activeSession: unknown): typeof apiFetch {
  return <TSchema extends z.ZodType>(path: string, options: { readonly schema: TSchema }) => {
    const response =
      path === '/sessions/quota'
        ? { enforced: false }
        : path === '/sessions/theme-categories'
          ? categories
          : activeSession

    return Promise.resolve(options.schema.parse(response))
  }
}

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

describe('HomePage', () => {
  afterEach(cleanup)

  it('starts quota, categories and active-session requests in one render pass', async () => {
    const paths: string[] = []
    const fetchFromApi: typeof apiFetch = <TSchema extends z.ZodType>(
      path: string,
      options: { readonly schema: TSchema },
    ) => {
      paths.push(path)
      const response =
        path === '/sessions/quota'
          ? { enforced: false }
          : path === '/sessions/theme-categories'
            ? categories
            : null

      return Promise.resolve(options.schema.parse(response))
    }
    const Page = createHomePage(fetchFromApi, () => Promise.resolve(practiceTranslations))
    const rendered = Page()

    expect(paths).toEqual(['/sessions/quota', '/sessions/theme-categories', '/sessions/active'])

    await rendered
  })

  it('shows available categories without repeating the quota shown in the header', async () => {
    // Vitest cannot execute next-intl's async server translation API in jsdom.
    const Page = createHomePage(createApiFetch(null), () => Promise.resolve(practiceTranslations))

    renderPage(await Page())

    expect(screen.queryByText(/análises restantes/u)).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Qual será o assunto de hoje?' })).toHaveClass(
      'font-(family-name:--font-buenard)',
    )
    expect(screen.getByRole('option', { name: 'Foco' })).toBeInTheDocument()
  })

  it('redirects an active session from the creation route to its canonical URL', async () => {
    const redirects: string[] = []
    const Page = createHomePage(
      createApiFetch({
        configuration: { categorySlug: 'focus', difficulty: 'balanced', searchWindowMinutes: 4 },
        createdAt: '2026-08-24T11:50:00.000Z',
        expiresAt: '2026-08-24T12:05:00.000Z',
        recordingStartedAt: null,
        researchEndsAt: '2026-08-24T12:03:00.000Z',
        serverNow: '2026-08-24T12:00:00.000Z',
        sessionId: '7d5f46c9-3cbd-4c6d-84aa-66b8148a91aa',
        themeId: '7d5f46c9-3cbd-4c6d-84aa-66b8148a91ab',
        themeTitle: 'Comunicação clara',
      }),
      () => Promise.resolve(practiceTranslations),
      (path) => {
        redirects.push(path)
        throw new DOMException('Redirected', 'RedirectError')
      },
    )

    await expect(Page()).rejects.toMatchObject({ name: 'RedirectError' })
    expect(redirects).toEqual(['/sessions/7d5f46c9-3cbd-4c6d-84aa-66b8148a91aa'])
  })
})

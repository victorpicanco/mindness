import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import type { ReactElement } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import type { z } from 'zod'

import { messages } from '@/i18n/messages'
import type { apiFetch } from '@/lib/api/server-client'

import { createHomePage } from './page'

const categories = [
  { categoryId: '7d5f46c9-3cbd-4c6d-84aa-66b8148a91aa', name: 'Foco', slug: 'focus' },
]

function practiceTranslations(key: string): string {
  const translations: Readonly<Record<string, string>> = {
    activeSession: 'Sua sessão em andamento',
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
    const response = path === '/sessions/theme-categories' ? categories : activeSession

    return Promise.resolve(options.schema.parse(response))
  }
}

function renderPage(page: ReactElement) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <NextIntlClientProvider locale="pt-BR" messages={messages}>
        {page}
      </NextIntlClientProvider>
    </QueryClientProvider>,
  )
}

describe('HomePage', () => {
  afterEach(cleanup)

  it('shows available categories without repeating the quota shown in the header', async () => {
    // Vitest cannot execute next-intl's async server translation API in jsdom.
    const Page = createHomePage(createApiFetch(null), () => Promise.resolve(practiceTranslations))

    renderPage(await Page({ quota: null }))

    expect(screen.queryByText(/análises restantes/u)).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Qual será o assunto de hoje?' })).toHaveClass(
      'font-(family-name:--font-buenard)',
    )
    expect(screen.getByRole('option', { name: 'Foco' })).toBeInTheDocument()
  })

  it('keeps an active session on the home route and passes it into the session provider', async () => {
    const Page = createHomePage(
      createApiFetch({
        configuration: { categorySlug: 'focus', difficulty: 'balanced', searchWindowMinutes: 4 },
        createdAt: '2026-08-24T11:50:00.000Z',
        expiresAt: '2026-08-24T12:05:00.000Z',
        sessionId: '7d5f46c9-3cbd-4c6d-84aa-66b8148a91aa',
        themeId: '7d5f46c9-3cbd-4c6d-84aa-66b8148a91ab',
        themeTitle: 'Comunicação clara',
      }),
      () => Promise.resolve(practiceTranslations),
    )

    renderPage(await Page({ quota: null }))

    expect(screen.getByText('Comunicação clara')).toBeInTheDocument()
  })
})

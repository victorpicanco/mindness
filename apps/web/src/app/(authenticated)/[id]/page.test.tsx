import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime'
import { NextIntlClientProvider } from 'next-intl'
import type { ReactElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { z } from 'zod'

import { messages } from '@/i18n/messages'
import type { apiFetch } from '@/lib/api/server-client'

import { createSessionPage } from './page'

const SESSION_ID = '7d5f46c9-3cbd-4c6d-84aa-66b8148a91aa'

function activeSession() {
  return {
    configuration: { categorySlug: 'focus', difficulty: 'balanced', searchWindowMinutes: 4 },
    createdAt: '2026-08-24T11:59:00.000Z',
    expiresAt: '2026-08-24T12:05:00.000Z',
    recordingStartedAt: null,
    researchEndsAt: '2026-08-24T12:03:00.000Z',
    sessionId: SESSION_ID,
    themeId: '7d5f46c9-3cbd-4c6d-84aa-66b8148a91ab',
    themeTitle: 'Comunicação clara',
  }
}

function createApiFetch(activeSession: unknown, sessions: unknown = []): typeof apiFetch {
  return <TSchema extends z.ZodType>(path: string, options: { readonly schema: TSchema }) =>
    Promise.resolve(options.schema.parse(path === '/sessions/active' ? activeSession : sessions))
}

function createRouter() {
  return {
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
    push: vi.fn(),
    refresh: vi.fn(),
    replace: vi.fn(),
  }
}

function renderPage(page: ReactElement) {
  return render(
    <AppRouterContext.Provider value={createRouter()}>
      <QueryClientProvider client={new QueryClient()}>
        <NextIntlClientProvider locale="pt-BR" messages={messages}>
          {page}
        </NextIntlClientProvider>
      </QueryClientProvider>
    </AppRouterContext.Provider>,
  )
}

describe('SessionPage', () => {
  afterEach(cleanup)

  it('rehydrates the research countdown of the session identified by the dynamic URL', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-24T12:00:00.000Z'))
    const Page = createSessionPage(createApiFetch(activeSession()))

    renderPage(await Page({ params: Promise.resolve({ id: SESSION_ID }) }))

    expect(screen.getByRole('heading', { name: 'Comunicação clara' })).toBeInTheDocument()
    expect(screen.getByRole('timer')).toHaveTextContent('03:00')
    expect(screen.queryByRole('button', { name: 'Iniciar gravação' })).not.toBeInTheDocument()
    vi.useRealTimers()
  })

  it('rehydrates into the recording window when the research time is already over', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-24T12:04:00.000Z'))
    const Page = createSessionPage(createApiFetch(activeSession()))

    renderPage(await Page({ params: Promise.resolve({ id: SESSION_ID }) }))

    expect(screen.getByRole('button', { name: 'Iniciar gravação' })).toBeEnabled()
    expect(screen.getByRole('timer')).toHaveTextContent('01:00')
    vi.useRealTimers()
  })

  it('rejects a URL that does not identify the active session', async () => {
    const notFound = vi.fn(() => {
      throw new DOMException('Not found', 'NotFoundError')
    })
    const Page = createSessionPage(createApiFetch(null), notFound)

    await expect(Page({ params: Promise.resolve({ id: SESSION_ID }) })).rejects.toMatchObject({
      name: 'NotFoundError',
    })
    expect(notFound).toHaveBeenCalledOnce()
  })

  it('represents a synchronized non-active session from the sidebar aggregate', async () => {
    const Page = createSessionPage(
      createApiFetch(null, [
        {
          bestOfDay: true,
          categorySlug: 'focus',
          difficulty: 'balanced',
          localDate: '24/08/2026',
          localTime: '09:00',
          sessionId: SESSION_ID,
          startedAt: '2026-08-24T12:00:00.000Z',
          state: 'completed',
          totalScore: 87,
        },
      ]),
    )

    renderPage(await Page({ params: Promise.resolve({ id: SESSION_ID }) }))

    expect(screen.getByRole('heading', { name: 'focus' })).toBeInTheDocument()
    expect(screen.getByText('Concluída')).toBeInTheDocument()
    expect(screen.getByText('87')).toBeInTheDocument()
  })
})

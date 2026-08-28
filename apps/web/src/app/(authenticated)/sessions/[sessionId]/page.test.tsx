import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, render, screen } from '@testing-library/react'
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime'
import { NextIntlClientProvider } from 'next-intl'
import type { ReactElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { z } from 'zod'

import { messages } from '@/i18n/messages'
import { ApiClientError } from '@/lib/api/client-error'
import type { apiFetch } from '@/lib/api/server-client'
import { PracticeSessionProvider } from '@/stores/practice-session/provider'
import type { PracticeSessionInitialState } from '@/stores/practice-session/store'

import { createSessionPage } from './page'

const SESSION_ID = '7d5f46c9-3cbd-4c6d-84aa-66b8148a91aa'

function activeSession() {
  return {
    configuration: { categorySlug: 'focus', difficulty: 'balanced', searchWindowMinutes: 4 },
    createdAt: '2026-08-24T11:59:00.000Z',
    expiresAt: '2026-08-24T12:05:00.000Z',
    recordingStartedAt: null,
    researchEndsAt: '2026-08-24T12:03:00.000Z',
    serverNow: '2026-08-24T12:00:00.000Z',
    sessionId: SESSION_ID,
    themeId: '7d5f46c9-3cbd-4c6d-84aa-66b8148a91ab',
    themeTitle: 'Comunicação clara',
  }
}

function createApiFetch(activeSession: unknown, sessions: unknown = []): typeof apiFetch {
  return <TSchema extends z.ZodType>(path: string, options: { readonly schema: TSchema }) => {
    if (path === '/sessions/active') {
      return Promise.resolve(options.schema.parse(activeSession))
    }
    if (path === '/sessions') return Promise.resolve(options.schema.parse(sessions))

    return Promise.reject(
      new ApiClientError({
        code: 'analyses.ANALYSIS_NOT_FOUND',
        issues: null,
        message: 'Analysis not found',
        requestId: 'request-id',
      }),
    )
  }
}

function completedSession() {
  return {
    bestOfDay: true,
    categorySlug: 'focus',
    difficulty: 'balanced' as const,
    localDate: '24/08/2026',
    localTime: '09:00',
    sessionId: SESSION_ID,
    startedAt: '2026-08-24T12:00:00.000Z',
    state: 'completed' as const,
    themeTitle: 'Notícias do dia',
    totalScore: 73,
  }
}

function analysis() {
  return {
    analyzedAt: '2026-08-24T12:10:00.000Z',
    guidance: [
      { pillar: 'clarity', text: 'Organize a ideia central antes de apresentar os detalhes.' },
      { pillar: 'fluency', text: 'Reduza as pausas entre frases relacionadas.' },
    ],
    scores: { clarity: 70, fluency: 60, mastery: 85, rhythm: 75, total: 73 },
    sessionId: SESSION_ID,
    transcript: '<strong>Texto puro</strong> **sem Markdown renderizado**',
  }
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

function renderPage(page: ReactElement, initialState?: PracticeSessionInitialState) {
  return render(
    <AppRouterContext.Provider value={createRouter()}>
      <QueryClientProvider client={new QueryClient()}>
        <NextIntlClientProvider locale="pt-BR" messages={messages}>
          <PracticeSessionProvider {...(initialState === undefined ? {} : { initialState })}>
            {page}
          </PracticeSessionProvider>
        </NextIntlClientProvider>
      </QueryClientProvider>
    </AppRouterContext.Provider>,
  )
}

type ActiveSession = Omit<ReturnType<typeof activeSession>, 'recordingStartedAt'> & {
  readonly recordingStartedAt: string | null
}

function practiceInitialState(
  status: PracticeSessionInitialState['status'],
  session: ActiveSession = activeSession(),
): PracticeSessionInitialState {
  return {
    serverTimeOffsetMs: new Date(session.serverNow).getTime() - Date.now(),
    session: {
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      recordingStartedAt: session.recordingStartedAt,
      researchEndsAt: session.researchEndsAt,
      sessionId: session.sessionId,
      themeTitle: session.themeTitle,
    },
    status,
  }
}

describe('SessionPage', () => {
  afterEach(cleanup)

  it('rehydrates the research countdown of the session identified by the dynamic URL', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-24T12:00:00.000Z'))
    const Page = createSessionPage(createApiFetch(activeSession()))

    renderPage(
      await Page({ params: Promise.resolve({ sessionId: SESSION_ID }) }),
      practiceInitialState('researching'),
    )

    expect(screen.getByRole('heading', { name: 'Comunicação clara' })).toBeInTheDocument()
    expect(screen.getByRole('timer')).toHaveTextContent('03:00')
    expect(screen.queryByRole('button', { name: 'Iniciar gravação' })).not.toBeInTheDocument()
    vi.useRealTimers()
  })

  it('rehydrates into the recording window when the research time is already over', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-24T12:04:00.000Z'))
    const Page = createSessionPage(createApiFetch(activeSession()))

    renderPage(
      await Page({ params: Promise.resolve({ sessionId: SESSION_ID }) }),
      practiceInitialState('awaiting-recording'),
    )

    await act(async () => {
      await Promise.resolve()
    })

    const deadline = new Intl.DateTimeFormat('pt-BR', {
      hour: '2-digit',
      hour12: false,
      minute: '2-digit',
    }).format(new Date(activeSession().expiresAt))

    expect(screen.getByRole('button', { name: 'Iniciar gravação' })).toBeEnabled()
    expect(screen.getByText(`Inicie sua gravação até ${deadline}`)).toBeInTheDocument()
    vi.useRealTimers()
  })

  it('does not restart a recording that was lost during a reload', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-24T12:04:00.000Z'))
    const session = { ...activeSession(), recordingStartedAt: '2026-08-24T12:04:00.000Z' }
    const Page = createSessionPage(createApiFetch(session))

    renderPage(
      await Page({ params: Promise.resolve({ sessionId: SESSION_ID }) }),
      practiceInitialState('expired', session),
    )

    expect(screen.queryByRole('button', { name: 'Iniciar gravação' })).not.toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Gravador de áudio' })).not.toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Sua sessão expirou porque a gravação não começou a tempo.',
    )
    vi.useRealTimers()
  })

  it('rejects a URL that does not identify the active session', async () => {
    const notFound = vi.fn(() => {
      throw new DOMException('Not found', 'NotFoundError')
    })
    const Page = createSessionPage(createApiFetch(null), notFound)

    await expect(
      Page({ params: Promise.resolve({ sessionId: SESSION_ID }) }),
    ).rejects.toMatchObject({
      name: 'NotFoundError',
    })
    expect(notFound).toHaveBeenCalledOnce()
  })

  it('represents a synchronized non-active session without an analysis from the sidebar aggregate', async () => {
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
          state: 'expired',
          themeTitle: 'Notícias do dia',
          totalScore: null,
        },
      ]),
    )

    renderPage(await Page({ params: Promise.resolve({ sessionId: SESSION_ID }) }))

    expect(screen.getByRole('heading', { name: 'focus' })).toBeInTheDocument()
    expect(screen.getByText('Expirada')).toBeInTheDocument()
  })

  it('renders scores, guidance and transcript as plain text for a completed session', async () => {
    const fetchFromApi: typeof apiFetch = (path, options) => {
      const response =
        path === '/sessions/active'
          ? null
          : path === '/sessions'
            ? [completedSession()]
            : analysis()

      return Promise.resolve(options.schema.parse(response))
    }
    const Page = createSessionPage(fetchFromApi)

    const { container } = renderPage(
      await Page({ params: Promise.resolve({ sessionId: SESSION_ID }) }),
    )

    expect(screen.getByRole('heading', { name: 'Sua análise' })).toBeInTheDocument()
    expect(screen.getByText('73')).toBeInTheDocument()
    expect(screen.getByText('70')).toBeInTheDocument()
    expect(screen.getByText('75')).toBeInTheDocument()
    expect(screen.getByText('60')).toBeInTheDocument()
    expect(screen.getByText('85')).toBeInTheDocument()
    expect(
      screen.getByText('Organize a ideia central antes de apresentar os detalhes.'),
    ).toBeInTheDocument()
    expect(screen.getByText('Reduza as pausas entre frases relacionadas.')).toBeInTheDocument()
    expect(
      screen.getByText('<strong>Texto puro</strong> **sem Markdown renderizado**'),
    ).toBeInTheDocument()
    expect(container.querySelector('strong')).not.toBeInTheDocument()
  })

  it('turns an analysis hidden by the backend into the route not-found boundary', async () => {
    const notFound = vi.fn(() => {
      throw new DOMException('Not found', 'NotFoundError')
    })
    const fetchFromApi: typeof apiFetch = (path, options) => {
      if (path === '/sessions/active') return Promise.resolve(options.schema.parse(null))
      if (path === '/sessions') {
        return Promise.resolve(options.schema.parse([completedSession()]))
      }

      return Promise.reject(
        new ApiClientError({
          code: 'analyses.ANALYSIS_NOT_FOUND',
          issues: null,
          message: 'Analysis not found',
          requestId: 'request-id',
        }),
      )
    }
    const Page = createSessionPage(fetchFromApi, notFound)

    await expect(
      Page({ params: Promise.resolve({ sessionId: SESSION_ID }) }),
    ).rejects.toMatchObject({ name: 'NotFoundError' })
    expect(notFound).toHaveBeenCalledOnce()
  })
})

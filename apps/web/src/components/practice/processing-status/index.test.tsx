import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, render, screen } from '@testing-library/react'
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime'
import { NextIntlClientProvider } from 'next-intl'
import { useEffect, type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { messages } from '@/i18n/messages'
import { ApiClientError } from '@/lib/api/client-error'
import {
  PracticeSessionProvider,
  usePracticeSessionStore,
} from '@/stores/practice-session/provider'

import { ProcessingStatusView, type FetchSessionAnalysis } from './index'

const SESSION_ID = '7d5f46c9-3cbd-4c6d-84aa-66b8148a91aa'

function BeginProcessing({ children }: { readonly children: ReactNode }) {
  const beginProcessing = usePracticeSessionStore((state) => state.beginProcessing)

  useEffect(() => beginProcessing(), [beginProcessing])

  return children
}

function PracticeStatus() {
  const status = usePracticeSessionStore((state) => state.status)
  return <span aria-label="practice status">{status}</span>
}

function renderProcessingStatus(fetchAnalysis: FetchSessionAnalysis) {
  const router = {
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
    push: vi.fn(),
    refresh: vi.fn(),
    replace: vi.fn(),
  }
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  render(
    <AppRouterContext.Provider value={router}>
      <NextIntlClientProvider locale="pt-BR" messages={messages}>
        <QueryClientProvider client={queryClient}>
          <PracticeSessionProvider
            initialState={{
              serverTimeOffsetMs: 0,
              session: {
                configuration: {
                  categorySlug: 'news',
                  difficulty: 'balanced',
                  searchWindowMinutes: 3,
                } as const,
                createdAt: '2026-08-27T12:00:00.000Z',
                expiresAt: '2026-08-27T12:15:00.000Z',
                recordingStartedAt: '2026-08-27T12:03:00.000Z',
                researchEndsAt: '2026-08-27T12:03:00.000Z',
                sessionId: SESSION_ID,
                themeTitle: 'Notícias do dia',
              },
              status: 'uploading',
            }}
          >
            <BeginProcessing>
              <ProcessingStatusView fetchAnalysis={fetchAnalysis} pollIntervalMs={1_000} />
              <PracticeStatus />
            </BeginProcessing>
          </PracticeSessionProvider>
        </QueryClientProvider>
      </NextIntlClientProvider>
    </AppRouterContext.Provider>,
  )

  return router
}

function apiError(code: string) {
  return new ApiClientError({
    code,
    issues: null,
    message: code,
    requestId: 'request-id',
  })
}

describe('ProcessingStatus', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('polls until the analysis exists, then keeps the conversation and opens the analysis', async () => {
    let calls = 0
    const fetchAnalysis: FetchSessionAnalysis = vi.fn(() => {
      calls += 1
      return calls === 1
        ? Promise.reject(apiError('analyses.ANALYSIS_NOT_FOUND'))
        : Promise.resolve({ sessionId: SESSION_ID })
    })
    const router = renderProcessingStatus(fetchAnalysis)

    await act(() => vi.advanceTimersByTimeAsync(1_000))
    await act(() => vi.advanceTimersByTimeAsync(0))

    expect(fetchAnalysis).toHaveBeenCalledTimes(2)
    await vi.waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1))
    expect(screen.getByLabelText('practice status')).toHaveTextContent('done')

    await act(() => vi.advanceTimersByTimeAsync(5_000))
    expect(fetchAnalysis).toHaveBeenCalledTimes(2)
  })

  it('announces the wait as a plain status line, outside any message surface', async () => {
    const fetchAnalysis: FetchSessionAnalysis = vi.fn(() => new Promise<never>(() => undefined))
    renderProcessingStatus(fetchAnalysis)

    await act(() => vi.advanceTimersByTimeAsync(0))

    const waiting = screen.getByRole('status')

    expect(waiting).toHaveTextContent('Estamos analisando sua apresentação…')
    expect(waiting.closest('article')).toBeNull()
  })

  it('never pushes a duplicate entry for the route it already renders on', async () => {
    const fetchAnalysis: FetchSessionAnalysis = vi.fn(() =>
      Promise.resolve({ sessionId: SESSION_ID }),
    )
    const router = renderProcessingStatus(fetchAnalysis)

    await act(() => vi.advanceTimersByTimeAsync(0))

    await vi.waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1))
    expect(router.push).not.toHaveBeenCalled()
  })

  it.each([
    [
      'analyses.ANALYSIS_FAILED',
      'Não foi possível analisar esta apresentação. Sua cota foi devolvida. Inicie uma nova sessão.',
    ],
    [
      'analyses.ANALYSIS_TIMEOUT',
      'A análise não foi concluída. Sua cota foi devolvida. Inicie uma nova sessão.',
    ],
  ])(
    'shows the terminal %s message and releases the store without navigating',
    async (code, message) => {
      const fetchAnalysis: FetchSessionAnalysis = vi.fn(() => Promise.reject(apiError(code)))
      const router = renderProcessingStatus(fetchAnalysis)

      await act(() => vi.advanceTimersByTimeAsync(0))

      expect(screen.getByRole('alert')).toHaveTextContent(message)
      expect(screen.getByRole('link', { name: 'Iniciar nova sessão' })).toHaveAttribute('href', '/')
      expect(router.push).not.toHaveBeenCalled()
      expect(router.refresh).not.toHaveBeenCalled()
      expect(screen.getByLabelText('practice status')).toHaveTextContent('idle')

      await act(() => vi.advanceTimersByTimeAsync(5_000))
      expect(fetchAnalysis).toHaveBeenCalledTimes(1)
    },
  )
})

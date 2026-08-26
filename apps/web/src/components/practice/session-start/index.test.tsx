import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime'
import { NextIntlClientProvider } from 'next-intl'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { messages } from '@/i18n/messages'
import { PracticeSessionProvider } from '@/stores/practice-session/provider'

import { PracticeSessionStart } from '@/components/practice/session-start'

describe('PracticeSessionStart', () => {
  afterEach(cleanup)

  it('opens the dynamic session URL and refreshes the server-synchronized shell', async () => {
    const push = vi.fn()
    const refresh = vi.fn()
    const router = {
      back: vi.fn(),
      forward: vi.fn(),
      prefetch: vi.fn(),
      push,
      refresh,
      replace: vi.fn(),
    }
    const sessionId = '7d5f46c9-3cbd-4c6d-84aa-66b8148a91aa'

    render(
      <AppRouterContext.Provider value={router}>
        <QueryClientProvider client={new QueryClient()}>
          <NextIntlClientProvider locale="pt-BR" messages={messages}>
            <PracticeSessionProvider>
              <PracticeSessionStart
                categories={[
                  {
                    categoryId: '7d5f46c9-3cbd-4c6d-84aa-66b8148a91ab',
                    name: 'Foco',
                    slug: 'focus',
                  },
                ]}
                signOut={() => undefined}
                quota={null}
                startSession={() =>
                  Promise.resolve({
                    createdAt: '2026-08-24T12:00:00.000Z',
                    expiresAt: '2026-08-24T12:05:00.000Z',
                    researchEndsAt: '2026-08-24T12:03:00.000Z',
                    sessionId,
                    themeTitle: 'Comunicação clara',
                  })
                }
              />
            </PracticeSessionProvider>
          </NextIntlClientProvider>
        </QueryClientProvider>
      </AppRouterContext.Provider>,
    )

    fireEvent.change(screen.getByLabelText('Dificuldade'), { target: { value: 'balanced' } })
    fireEvent.change(screen.getByLabelText('Categoria'), { target: { value: 'focus' } })
    fireEvent.change(screen.getByLabelText('Tempo de pesquisa'), { target: { value: '4' } })
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sessão' }))

    await waitFor(() => expect(push).toHaveBeenCalledWith(`/sessions/${sessionId}`))
    expect(refresh).toHaveBeenCalledOnce()
  })
})

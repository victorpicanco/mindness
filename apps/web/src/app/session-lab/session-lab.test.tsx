import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime'
import { NextIntlClientProvider } from 'next-intl'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { messages } from '@/i18n/messages'

import { SessionLab } from './session-lab'

function renderSessionLab() {
  return render(
    <AppRouterContext.Provider value={createRouter()}>
      <QueryClientProvider client={new QueryClient()}>
        <NextIntlClientProvider locale="pt-BR" messages={messages}>
          <SessionLab />
        </NextIntlClientProvider>
      </QueryClientProvider>
    </AppRouterContext.Provider>,
  )
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

describe('SessionLab', () => {
  afterEach(cleanup)

  it('renders the current authenticated shell and the unconfigured session form', () => {
    renderSessionLab()

    expect(
      screen.getByRole('complementary', { name: 'Navegação do aplicativo' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Qual será o assunto de hoje?' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Iniciar sessão' })).toBeDisabled()
    expect(screen.getByLabelText('Cota de sessões')).toHaveTextContent('3/4 sessões restantes')
  })

  it('uses only local data to start the existing research screen', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    renderSessionLab()

    fireEvent.change(screen.getByLabelText('Dificuldade'), { target: { value: 'balanced' } })
    fireEvent.change(screen.getByLabelText('Categoria'), { target: { value: 'communication' } })
    fireEvent.change(screen.getByLabelText('Tempo de pesquisa'), { target: { value: '4' } })
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sessão' }))

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Comunicação clara em conversas difíceis' }),
      ).toBeInTheDocument()
    })
    expect(screen.getByRole('timer')).toBeInTheDocument()
    expect(fetchSpy).not.toHaveBeenCalled()

    vi.unstubAllGlobals()
  })

  it('opens the two-minute recording grace screen when research ends', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-24T12:00:00.000Z'))
    renderSessionLab()

    fireEvent.change(screen.getByLabelText('Dificuldade'), { target: { value: 'balanced' } })
    fireEvent.change(screen.getByLabelText('Categoria'), { target: { value: 'communication' } })
    fireEvent.change(screen.getByLabelText('Tempo de pesquisa'), { target: { value: '4' } })
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sessão' }))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3 * 60 * 1_000)
    })

    expect(screen.getByText('Seu tempo de pesquisa terminou')).toBeInTheDocument()
    expect(screen.getByRole('timer')).toHaveTextContent('02:00')
    expect(screen.getByRole('button', { name: 'Iniciar gravação' })).toBeEnabled()

    vi.useRealTimers()
  })
})

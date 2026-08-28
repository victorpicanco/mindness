import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { messages } from '@/i18n/messages'

vi.mock('next-intl/server', () => ({
  getTranslations: () =>
    Promise.resolve((key: string) => {
      const values: Readonly<Record<string, string>> = {
        description: 'O endereço informado não existe.',
        home: 'Voltar ao início',
        title: 'Página não encontrada',
      }

      return values[key] ?? key
    }),
}))

import ErrorBoundary from './error'
import Loading from './loading'
import NotFound from './not-found'

function renderWithMessages(content: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="pt-BR" messages={messages}>
      {content}
    </NextIntlClientProvider>,
  )
}

describe('route boundaries', () => {
  afterEach(cleanup)

  it('announces route loading immediately', () => {
    renderWithMessages(<Loading />)

    expect(screen.getByRole('status', { name: 'Carregando' })).toBeInTheDocument()
  })

  it('offers recovery after a route error', () => {
    const reset = vi.fn()

    renderWithMessages(<ErrorBoundary error={new TypeError('failed')} reset={reset} />)
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível carregar esta página.')
    expect(reset).toHaveBeenCalledOnce()
  })

  it('explains that an unknown route does not exist', async () => {
    renderWithMessages(await NotFound())

    expect(screen.getByRole('heading', { name: 'Página não encontrada' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Voltar ao início' })).toHaveAttribute('href', '/')
  })
})

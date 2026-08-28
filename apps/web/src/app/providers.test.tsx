import { useMutation } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { messages } from '@/i18n/messages'
import { ApiClientError } from '@/lib/api/client-error'

import { Providers } from './providers'

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

function FailingMutation({ presentation }: { readonly presentation?: 'inline' }) {
  const mutation = useMutation({
    ...(presentation === undefined ? {} : { meta: { errorPresentation: presentation } }),
    mutationFn: () =>
      Promise.reject(
        new ApiClientError({
          code: 'web.API_REQUEST_FAILED',
          issues: null,
          message: 'Unable to reach the API.',
          requestId: null,
        }),
      ),
  })

  return (
    <button disabled={mutation.isPending} onClick={() => mutation.mutate()} type="button">
      {mutation.isError ? 'Falhou' : 'Iniciar sessão'}
    </button>
  )
}

function renderMutation(presentation?: 'inline') {
  render(
    <NextIntlClientProvider locale="pt-BR" messages={messages}>
      <Providers>
        <FailingMutation {...(presentation === undefined ? {} : { presentation })} />
      </Providers>
    </NextIntlClientProvider>,
  )

  fireEvent.click(screen.getByRole('button', { name: 'Iniciar sessão' }))
}

describe('Providers', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('renders children inside the application providers', () => {
    expect(() =>
      render(
        <NextIntlClientProvider locale="pt-BR" messages={messages}>
          <Providers>
            <p>Provider child</p>
          </Providers>
        </NextIntlClientProvider>,
      ),
    ).not.toThrow()

    expect(screen.getByText('Provider child')).toBeInTheDocument()
  })

  it('toasts a failed mutation that does not declare its own presentation', async () => {
    const { toast } = await import('sonner')
    renderMutation()

    await vi.waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        'Não foi possível conectar ao servidor. Verifique sua conexão.',
      ),
    )
  })

  it('stays quiet for a mutation that renders its own errors inline', async () => {
    const { toast } = await import('sonner')
    renderMutation('inline')

    await screen.findByRole('button', { name: 'Falhou' })

    expect(toast.error).not.toHaveBeenCalled()
  })
})

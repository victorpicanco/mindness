import { useMutation } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AlertDialogProvider } from '@/components/providers/alert-dialog-provider'
import { messages } from '@/i18n/messages'
import { ApiClientError } from '@/lib/api/client-error'
import { alertDialogStore, dismissAlertDialog } from '@/lib/feedback/alert-dialog'

import { Providers } from './providers'

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

function FailingMutation({
  announcesOwnFailure,
  code = 'web.API_REQUEST_FAILED',
}: {
  readonly announcesOwnFailure?: boolean
  readonly code?: string
}) {
  const mutation = useMutation({
    ...(announcesOwnFailure === undefined ? {} : { meta: { announcesOwnFailure } }),
    mutationFn: () =>
      Promise.reject(
        new ApiClientError({
          code,
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

function renderMutation(props: { announcesOwnFailure?: boolean; code?: string } = {}) {
  render(
    <NextIntlClientProvider locale="pt-BR" messages={messages}>
      <Providers>
        <FailingMutation {...props} />
        <AlertDialogProvider />
      </Providers>
    </NextIntlClientProvider>,
  )

  fireEvent.click(screen.getByRole('button', { name: 'Iniciar sessão' }))
}

describe('Providers', () => {
  afterEach(() => {
    dismissAlertDialog()
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

  it('raises a blocking mutation failure as a dialog instead of a toast', async () => {
    const { toast } = await import('sonner')
    renderMutation({ code: 'web.MICROPHONE_UNAVAILABLE' })

    expect(
      await screen.findByRole('dialog', { name: 'Não foi possível continuar' }),
    ).toHaveAccessibleDescription('Não foi possível acessar o microfone.')
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('stays quiet for a mutation that announces its own failure', async () => {
    const { toast } = await import('sonner')
    renderMutation({ announcesOwnFailure: true, code: 'web.MICROPHONE_UNAVAILABLE' })

    await screen.findByRole('button', { name: 'Falhou' })

    expect(toast.error).not.toHaveBeenCalled()
    expect(alertDialogStore.getState().request).toBeNull()
  })
})

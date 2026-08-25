import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { TurnstileApi, TurnstileRenderOptions } from '@/components/ui/turnstile/types'
import { messages } from '@/i18n/messages'
import { initialAuthActionState, type AuthActionState } from '@/lib/auth/action-state'

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

import { EmailRequestForm } from './index'

type EmailRequestAction = (state: AuthActionState, formData: FormData) => Promise<AuthActionState>

const widgets: TurnstileRenderOptions[] = []

function installTurnstile(): void {
  window.turnstile = {
    render: (_container, options) => {
      widgets.push(options)

      return `widget-${String(widgets.length - 1)}`
    },
    remove: () => {},
    reset: () => {},
  } satisfies TurnstileApi
}

async function verifyCaptcha(token = 'captcha-token'): Promise<void> {
  await waitFor(() => {
    expect(widgets).not.toHaveLength(0)
  })
  await act(() => {
    widgets[0]?.callback(token)

    return Promise.resolve()
  })
}

function renderForm(action: EmailRequestAction) {
  return render(
    <NextIntlClientProvider locale="pt-BR" messages={messages}>
      <EmailRequestForm
        action={action}
        submitLabel="Enviar link de recuperação"
        successMessage="Se houver uma conta elegível, o link chegará por e-mail."
      />
    </NextIntlClientProvider>,
  )
}

function submit(): void {
  fireEvent.click(screen.getByRole('button', { name: 'Enviar link de recuperação' }))
}

beforeEach(async () => {
  const { toast } = await import('sonner')
  vi.mocked(toast.error).mockClear()
  widgets.length = 0
  vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', 'site-key')
  installTurnstile()
})

afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
  delete window.turnstile
})

describe('EmailRequestForm', () => {
  it('holds an invalid email before calling the action', async () => {
    const calls: FormData[] = []

    renderForm((_state, formData) => {
      calls.push(formData)

      return Promise.resolve(initialAuthActionState)
    })
    await verifyCaptcha()
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'not-an-email' } })
    submit()

    expect(await screen.findByText('Informe um e-mail válido.')).toBeInTheDocument()
    expect(calls).toEqual([])
  })

  it('raises a throttled request as a toast instead of a generic inline failure', async () => {
    const { toast } = await import('sonner')

    renderForm(() =>
      Promise.resolve<AuthActionState>({
        status: 'api-error',
        error: { code: 'accounts.RATE_LIMITED', issues: null, requestId: 'request-id' },
      }),
    )
    await verifyCaptcha()
    fireEvent.change(screen.getByLabelText('E-mail'), {
      target: { value: 'person@example.com' },
    })
    submit()

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'Tentativas demais em pouco tempo. Aguarde um minuto e tente de novo.',
        { id: 'request-id' },
      )
    })
  })

  it('announces the neutral success message', async () => {
    renderForm(() => Promise.resolve<AuthActionState>({ status: 'success' }))
    await verifyCaptcha()
    fireEvent.change(screen.getByLabelText('E-mail'), {
      target: { value: 'person@example.com' },
    })
    submit()

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Se houver uma conta elegível, o link chegará por e-mail.',
    )
  })

  it('waits for the security verification instead of rejecting the submission', async () => {
    const calls: FormData[] = []

    renderForm((_state, formData) => {
      calls.push(formData)

      return Promise.resolve(initialAuthActionState)
    })
    fireEvent.change(screen.getByLabelText('E-mail'), {
      target: { value: 'person@example.com' },
    })
    submit()

    expect(calls).toEqual([])

    await verifyCaptcha('late-token')

    await waitFor(() => {
      expect(calls).toHaveLength(1)
    })
    expect(calls[0]?.get('captchaToken')).toBe('late-token')
  })

  it('gives up waiting for a verification that never arrives', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const calls: FormData[] = []

    try {
      renderForm((_state, formData) => {
        calls.push(formData)

        return Promise.resolve(initialAuthActionState)
      })
      fireEvent.change(screen.getByLabelText('E-mail'), {
        target: { value: 'person@example.com' },
      })
      submit()

      await act(async () => {
        await vi.advanceTimersByTimeAsync(20_000)
      })

      expect(
        screen.getByText(
          'A verificação de segurança não carregou. Recarregue a página e tente novamente.',
        ),
      ).toBeInTheDocument()
      expect(calls).toEqual([])
    } finally {
      vi.useRealTimers()
    }
  })
})

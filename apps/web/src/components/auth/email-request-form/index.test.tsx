import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AlertDialogProvider } from '@/components/providers/alert-dialog-provider'
import type { TurnstileApi, TurnstileRenderOptions } from '@/components/ui/turnstile/types'
import { messages } from '@/i18n/messages'
import { initialAuthActionState, type AuthActionState } from '@/lib/auth/action-state'
import { dismissAlertDialog } from '@/lib/feedback/alert-dialog'

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
      <AlertDialogProvider />
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
  act(() => {
    dismissAlertDialog()
  })
  cleanup()
  vi.unstubAllEnvs()
  delete window.turnstile
})

describe('EmailRequestForm', () => {
  it('hints the expected email format in the field', () => {
    renderForm(() => Promise.resolve(initialAuthActionState))

    expect(screen.getByLabelText('E-mail')).toHaveAttribute('placeholder', 'email@exemplo.com')
  })

  it('shows the invalid email returned by the action', async () => {
    const calls: FormData[] = []

    renderForm((_state, formData) => {
      calls.push(formData)

      return Promise.resolve({ status: 'validation-error', messageKey: 'errors.invalidEmail' })
    })
    await verifyCaptcha()
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'not-an-email' } })
    submit()

    expect(await screen.findByText('Informe um e-mail válido.')).toBeInTheDocument()
    expect(calls).toHaveLength(1)
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

  it('announces the neutral success message as a dialog the user has to acknowledge', async () => {
    renderForm(() => Promise.resolve<AuthActionState>({ status: 'success' }))
    await verifyCaptcha()
    fireEvent.change(screen.getByLabelText('E-mail'), {
      target: { value: 'person@example.com' },
    })
    submit()

    expect(await screen.findByRole('dialog', { name: 'Tudo certo' })).toHaveAccessibleDescription(
      'Se houver uma conta elegível, o link chegará por e-mail.',
    )
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('keeps the unusable security verification off the form and in a dialog', async () => {
    vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', '')
    renderForm(() => Promise.resolve(initialAuthActionState))

    expect(
      await screen.findByRole('dialog', { name: 'Não foi possível continuar' }),
    ).toHaveAccessibleDescription(
      'A verificação de segurança não carregou. Recarregue a página e tente novamente.',
    )
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('submits the current security verification value without polling', async () => {
    const calls: FormData[] = []

    renderForm((_state, formData) => {
      calls.push(formData)

      return Promise.resolve(initialAuthActionState)
    })
    fireEvent.change(screen.getByLabelText('E-mail'), {
      target: { value: 'person@example.com' },
    })
    submit()

    await waitFor(() => {
      expect(calls).toHaveLength(1)
    })
    expect(calls[0]?.get('captchaToken')).toBe('')
  })
})

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { TurnstileApi, TurnstileRenderOptions } from '@/components/ui/turnstile/types'
import { messages } from '@/i18n/messages'
import type { ApiErrorDescription } from '@/lib/errors/api-error-presentation'

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

import { initialAuthActionState, type AuthActionState } from '../auth-action-state'

import { SignInForm } from './sign-in-form'

type SignInAction = (state: AuthActionState, formData: FormData) => Promise<AuthActionState>

const widgets: TurnstileRenderOptions[] = []
const resetWidgets: string[] = []

function installTurnstile(): void {
  const api: TurnstileApi = {
    render: (_container, options) => {
      widgets.push(options)

      return `widget-${String(widgets.length - 1)}`
    },
    remove: () => {},
    reset: (widgetId) => {
      resetWidgets.push(widgetId)
    },
  }

  window.turnstile = api
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

function renderSignInForm(action: SignInAction, initialError?: ApiErrorDescription) {
  return render(
    <NextIntlClientProvider locale="pt-BR" messages={messages}>
      <SignInForm action={action} {...(initialError === undefined ? {} : { initialError })} />
    </NextIntlClientProvider>,
  )
}

function renderSignInFormReturningTo(action: SignInAction, redirectTo: string) {
  return render(
    <NextIntlClientProvider locale="pt-BR" messages={messages}>
      <SignInForm action={action} redirectTo={redirectTo} />
    </NextIntlClientProvider>,
  )
}

function fillCredentials(email = 'person@example.com', password = 'a-valid-password'): void {
  fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: email } })
  fireEvent.change(screen.getByLabelText('Senha'), { target: { value: password } })
}

function submit(): void {
  fireEvent.click(screen.getByRole('button', { name: 'Avançar' }))
}

beforeEach(async () => {
  const { toast } = await import('sonner')
  vi.mocked(toast.error).mockClear()
  widgets.length = 0
  resetWidgets.length = 0
  vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'https://api.mindness.test')
  vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', 'site-key')
  installTurnstile()
})

afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
  delete window.turnstile
})

describe('SignInForm', () => {
  it('shows the consent notice next to Google entry without making sign-in conditional on interaction', async () => {
    const submittedFormData: FormData[] = []
    const signInAction: SignInAction = (_state, formData) => {
      submittedFormData.push(formData)

      return Promise.resolve(initialAuthActionState)
    }

    renderSignInForm(signInAction)

    expect(
      screen.getByText(
        'Ao criar sua conta, você aceita os termos de uso e a política de privacidade. Sua voz será gravada e analisada para gerar sua devolutiva. O áudio é retido por 30 dias.',
      ),
    ).toBeInTheDocument()

    await verifyCaptcha()
    fillCredentials()
    submit()

    await waitFor(() => {
      expect(submittedFormData).toHaveLength(1)
    })
  })

  it('submits valid credentials to signInAction', async () => {
    const submittedFormData: FormData[] = []
    const signInAction: SignInAction = (_state, formData) => {
      submittedFormData.push(formData)

      return Promise.resolve(initialAuthActionState)
    }

    renderSignInForm(signInAction)
    await verifyCaptcha()
    fillCredentials()
    submit()

    await waitFor(() => {
      expect(submittedFormData).toHaveLength(1)
    })
    expect(submittedFormData[0]?.get('email')).toBe('person@example.com')
    expect(submittedFormData[0]?.get('captchaToken')).toBe('captcha-token')
  })

  it('rejects an invalid email without calling the action', async () => {
    const calls: FormData[] = []
    const signInAction: SignInAction = (_state, formData) => {
      calls.push(formData)

      return Promise.resolve(initialAuthActionState)
    }

    renderSignInForm(signInAction)
    await verifyCaptcha()
    fillCredentials('not-an-email')
    submit()

    expect(await screen.findByText('Informe um e-mail válido.')).toBeInTheDocument()
    expect(calls).toEqual([])
  })

  it('rejects a missing password without calling the action', async () => {
    const calls: FormData[] = []
    const signInAction: SignInAction = (_state, formData) => {
      calls.push(formData)

      return Promise.resolve(initialAuthActionState)
    }

    renderSignInForm(signInAction)
    await verifyCaptcha()
    fillCredentials('person@example.com', '')
    submit()

    expect(await screen.findByText('Informe sua senha.')).toBeInTheDocument()
    expect(calls).toEqual([])
  })

  it('waits for the security verification instead of rejecting the submission', async () => {
    const calls: FormData[] = []
    const signInAction: SignInAction = (_state, formData) => {
      calls.push(formData)

      return Promise.resolve(initialAuthActionState)
    }

    renderSignInForm(signInAction)
    fillCredentials()
    submit()

    expect(calls).toEqual([])

    await verifyCaptcha('late-token')

    await waitFor(() => {
      expect(calls).toHaveLength(1)
    })
    expect(calls[0]?.get('captchaToken')).toBe('late-token')
  })

  it('reports when the security verification becomes unavailable', async () => {
    renderSignInForm(() => Promise.resolve(initialAuthActionState))

    await waitFor(() => {
      expect(widgets).not.toHaveLength(0)
    })
    act(() => {
      widgets[0]?.['error-callback']('network-error')
    })

    expect(
      screen.getByText(
        'A verificação de segurança não carregou. Recarregue a página e tente novamente.',
      ),
    ).toBeInTheDocument()
  })

  it('raises the authentication rejection as a toast, not next to a field', async () => {
    const { toast } = await import('sonner')
    const signInAction: SignInAction = () =>
      Promise.resolve({
        status: 'api-error',
        error: {
          code: 'accounts.AUTHENTICATION_REJECTED',
          issues: null,
          requestId: 'request-id',
        },
      })

    renderSignInForm(signInAction)
    await verifyCaptcha()
    fillCredentials()
    submit()

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('E-mail ou senha incorretos.', { id: 'request-id' })
    })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('offers the confirmation resend when the email was never confirmed', async () => {
    const signInAction: SignInAction = () =>
      Promise.resolve({
        status: 'api-error',
        error: {
          code: 'accounts.EMAIL_NOT_CONFIRMED',
          issues: null,
          requestId: 'request-id',
        },
      })

    renderSignInForm(signInAction)
    await verifyCaptcha()
    fillCredentials()
    submit()

    expect(
      await screen.findByRole('link', { name: 'Reenviar e-mail de confirmação' }),
    ).toHaveAttribute('href', '/auth/resend-confirmation')
  })

  it('resets the security verification after a rejected submission', async () => {
    const signInAction: SignInAction = () =>
      Promise.resolve({
        status: 'api-error',
        error: {
          code: 'accounts.AUTHENTICATION_REJECTED',
          issues: null,
          requestId: 'request-id',
        },
      })

    renderSignInForm(signInAction)
    await verifyCaptcha()
    fillCredentials()
    submit()

    await waitFor(() => {
      expect(resetWidgets).toEqual(['widget-0'])
    })
  })

  it('raises the beta capacity limit as a toast', async () => {
    const { toast } = await import('sonner')
    const signInAction: SignInAction = () =>
      Promise.resolve({
        status: 'api-error',
        error: {
          code: 'accounts.BETA_CAPACITY_REACHED',
          issues: null,
          requestId: 'request-id',
        },
      })

    renderSignInForm(signInAction)
    await verifyCaptcha()
    fillCredentials()
    submit()

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'O beta atingiu o limite de contas. Avisaremos quando abrirem novas vagas.',
        { id: 'request-id' },
      )
    })
  })

  it('attaches an API field issue to the field it belongs to', async () => {
    const signInAction: SignInAction = () =>
      Promise.resolve({
        status: 'api-error',
        error: {
          code: 'shared.VALIDATION_FAILED',
          issues: [{ field: 'email', message: 'must match format "email"' }],
          requestId: 'request-id',
        },
      })

    renderSignInForm(signInAction)
    await verifyCaptcha()
    fillCredentials()
    submit()

    expect(await screen.findByText('Informe um e-mail válido.')).toBeInTheDocument()
  })

  it('raises the failure of the Google round trip as a toast', async () => {
    const { toast } = await import('sonner')

    renderSignInForm(() => Promise.resolve(initialAuthActionState), {
      messageKey: 'auth.errors.googleSignInFailed',
      presentation: 'toast',
    })

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'Não foi possível entrar com o Google. Tente novamente.',
      )
    })
  })

  it('links to the Google authorization endpoint', () => {
    renderSignInForm(() => Promise.resolve(initialAuthActionState))

    expect(screen.getByRole('link', { name: 'Entrar com Google' })).toHaveAttribute(
      'href',
      'https://api.mindness.test/auth/google',
    )
  })

  it('places the password recovery link below and aligned with the password input', () => {
    renderSignInForm(() => Promise.resolve(initialAuthActionState))

    const passwordInput = screen.getByLabelText('Senha')
    const recoveryLink = screen.getByRole('link', { name: 'Esqueci minha senha' })
    const passwordField = passwordInput.parentElement?.parentElement

    if (passwordField === null || passwordField === undefined) {
      expect(passwordField).not.toBeNull()
      return
    }

    expect(passwordField.parentElement).toContainElement(recoveryLink)
    expect(passwordField.parentElement).toHaveClass('grid', 'gap-1')
    expect(recoveryLink).toHaveClass('justify-self-end')
  })

  it('separates the credential fields from the submit action', () => {
    renderSignInForm(() => Promise.resolve(initialAuthActionState))

    const form = screen.getByRole('button', { name: 'Avançar' }).closest('form')

    expect(form).toHaveClass('gap-8')
  })

  it('carries the page that bounced the visitor back to the action', async () => {
    const submittedFormData: FormData[] = []
    const signInAction: SignInAction = (_state, formData) => {
      submittedFormData.push(formData)

      return Promise.resolve(initialAuthActionState)
    }

    renderSignInFormReturningTo(signInAction, '/practice/session?id=1')
    await verifyCaptcha()
    fillCredentials()
    submit()

    await waitFor(() => {
      expect(submittedFormData).toHaveLength(1)
    })
    expect(submittedFormData[0]?.get('redirectTo')).toBe('/practice/session?id=1')
  })

  it('submits nothing extra when the visitor came straight to sign-in', async () => {
    const submittedFormData: FormData[] = []
    const signInAction: SignInAction = (_state, formData) => {
      submittedFormData.push(formData)

      return Promise.resolve(initialAuthActionState)
    }

    renderSignInForm(signInAction)
    await verifyCaptcha()
    fillCredentials()
    submit()

    await waitFor(() => {
      expect(submittedFormData).toHaveLength(1)
    })
    expect(submittedFormData[0]?.get('redirectTo')).toBeNull()
  })
})

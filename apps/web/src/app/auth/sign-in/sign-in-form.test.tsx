import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { TurnstileApi, TurnstileRenderOptions } from '@/components/ui/turnstile/types'
import { messages } from '@/i18n/messages'

import { SignInForm } from './sign-in-form'
import { initialSignInActionState, type SignInActionState } from './types'

type SignInAction = (state: SignInActionState, formData: FormData) => Promise<SignInActionState>

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

function renderSignInForm(
  action: SignInAction,
  initialErrorMessageKey?: 'auth.errors.googleSignInFailed',
) {
  return render(
    <NextIntlClientProvider locale="pt-BR" messages={messages}>
      <SignInForm
        action={action}
        {...(initialErrorMessageKey === undefined ? {} : { initialErrorMessageKey })}
      />
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

beforeEach(() => {
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
  it('submits valid credentials to signInAction', async () => {
    const submittedFormData: FormData[] = []
    const signInAction: SignInAction = (_state, formData) => {
      submittedFormData.push(formData)

      return Promise.resolve(initialSignInActionState)
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

      return Promise.resolve(initialSignInActionState)
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

      return Promise.resolve(initialSignInActionState)
    }

    renderSignInForm(signInAction)
    await verifyCaptcha()
    fillCredentials('person@example.com', '')
    submit()

    expect(await screen.findByText('Informe sua senha.')).toBeInTheDocument()
    expect(calls).toEqual([])
  })

  it('asks for the security verification before calling the action', async () => {
    const calls: FormData[] = []
    const signInAction: SignInAction = (_state, formData) => {
      calls.push(formData)

      return Promise.resolve(initialSignInActionState)
    }

    renderSignInForm(signInAction)
    fillCredentials()
    submit()

    expect(
      await screen.findByText('Conclua a verificação de segurança para continuar.'),
    ).toBeInTheDocument()
    expect(calls).toEqual([])
  })

  it('reports when the security verification becomes unavailable', async () => {
    renderSignInForm(() => Promise.resolve(initialSignInActionState))

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

  it('shows the authentication rejection message returned by the action', async () => {
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

    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou senha incorretos.')
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

  it('shows the beta capacity message returned by the action', async () => {
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

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'O beta atingiu o limite de contas. Avisaremos quando abrirem novas vagas.',
    )
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

  it('shows the failure of the Google round trip reported by the callback', () => {
    renderSignInForm(
      () => Promise.resolve(initialSignInActionState),
      'auth.errors.googleSignInFailed',
    )

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Não foi possível entrar com o Google. Tente novamente.',
    )
  })

  it('links to the Google authorization endpoint', () => {
    renderSignInForm(() => Promise.resolve(initialSignInActionState))

    expect(screen.getByRole('link', { name: 'Entrar com Google' })).toHaveAttribute(
      'href',
      'https://api.mindness.test/auth/google',
    )
  })

  it('separates the credential fields from the submit action', () => {
    renderSignInForm(() => Promise.resolve(initialSignInActionState))

    const form = screen.getByRole('button', { name: 'Avançar' }).closest('form')

    expect(form).toHaveClass('gap-8')
  })
})

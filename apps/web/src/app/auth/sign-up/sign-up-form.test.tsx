import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import type { ReactElement } from 'react'
import { Toaster } from 'sonner'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { TurnstileApi, TurnstileRenderOptions } from '@/components/ui/turnstile/types'
import { messages } from '@/i18n/messages'

import { initialAuthActionState, type AuthActionState } from '../auth-action-state'

import { SignUpForm } from './sign-up-form'

type SignUpAction = (state: AuthActionState, formData: FormData) => Promise<AuthActionState>

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

function validSignUpAction(): SignUpAction {
  return () => Promise.resolve<AuthActionState>({ status: 'success' })
}

function renderSignUpForm(element: ReactElement) {
  return render(
    <NextIntlClientProvider locale="pt-BR" messages={messages}>
      <Toaster />
      {element}
    </NextIntlClientProvider>,
  )
}

function fillCredentials(password = 'Valid_password1!', confirmation = password): void {
  fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'person@example.com' } })
  fireEvent.change(screen.getByLabelText('Senha'), { target: { value: password } })
  fireEvent.change(screen.getByLabelText('Confirme sua senha'), {
    target: { value: confirmation },
  })
}

function submit(): void {
  fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }))
}

beforeEach(() => {
  widgets.length = 0
  resetWidgets.length = 0
  vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', 'site-key')
  installTurnstile()
})

afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
  delete window.turnstile
})

describe('SignUpForm', () => {
  it('shows the Supabase password requirements and marks satisfied requirements', () => {
    renderSignUpForm(<SignUpForm action={validSignUpAction()} />)

    const requirementList = screen.getByRole('list', { name: 'Requisitos da senha' })

    expect(requirementList).toHaveTextContent('Pelo menos 8 caracteres')
    expect(requirementList).toHaveTextContent('Uma letra minúscula')
    expect(requirementList).toHaveTextContent('Uma letra maiúscula')
    expect(requirementList).toHaveTextContent('Um número')
    expect(requirementList).toHaveTextContent('Um símbolo')

    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'Abcdef1!' } })

    expect(requirementList.querySelectorAll('[data-satisfied="true"]')).toHaveLength(5)
  })

  it('submits valid credentials and notifies the page of the email confirmation state', async () => {
    const submittedFormData: FormData[] = []
    let successNotifications = 0
    const signUpAction: SignUpAction = async (state, formData) => {
      submittedFormData.push(formData)

      return validSignUpAction()(state, formData)
    }

    renderSignUpForm(
      <SignUpForm
        action={signUpAction}
        onSuccess={() => {
          successNotifications += 1
        }}
      />,
    )
    await verifyCaptcha()
    fillCredentials()
    submit()

    await waitFor(() => {
      expect(successNotifications).toBe(1)
    })

    expect(submittedFormData).toHaveLength(1)
    expect(submittedFormData[0]?.get('email')).toBe('person@example.com')
    expect(submittedFormData[0]?.get('captchaToken')).toBe('captcha-token')
  })

  it('rejects a password confirmation that differs from the password without submitting', async () => {
    let submissions = 0
    const signUpAction: SignUpAction = () => {
      submissions += 1

      return Promise.resolve(initialAuthActionState)
    }

    renderSignUpForm(<SignUpForm action={signUpAction} />)
    await verifyCaptcha()
    fillCredentials('Valid_password1!', 'Different_password1!')
    submit()

    expect(screen.getByRole('alert')).toHaveTextContent('As senhas não coincidem.')
    expect(screen.getByLabelText('Confirme sua senha')).toHaveAttribute('aria-invalid', 'true')
    expect(submissions).toBe(0)
  })

  it('announces every invalid field at once without submitting', async () => {
    let submissions = 0
    const signUpAction: SignUpAction = () => {
      submissions += 1

      return Promise.resolve(initialAuthActionState)
    }

    renderSignUpForm(<SignUpForm action={signUpAction} />)
    await verifyCaptcha()
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'invalid' } })
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'short' } })
    fireEvent.change(screen.getByLabelText('Confirme sua senha'), { target: { value: 'other' } })
    submit()

    expect(screen.getByLabelText('E-mail')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Senha')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Confirme sua senha')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText('Informe um e-mail válido.')).toBeInTheDocument()
    expect(screen.getByText('As senhas não coincidem.')).toBeInTheDocument()
    expect(submissions).toBe(0)
  })

  it('waits for the security verification instead of rejecting the submission', async () => {
    const calls: FormData[] = []
    const signUpAction: SignUpAction = (_state, formData) => {
      calls.push(formData)

      return Promise.resolve(initialAuthActionState)
    }

    renderSignUpForm(<SignUpForm action={signUpAction} />)
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
    renderSignUpForm(<SignUpForm action={validSignUpAction()} />)

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

  it('shows inline the password the identity provider refused', async () => {
    const signUpAction: SignUpAction = () =>
      Promise.resolve({
        status: 'api-error',
        error: {
          code: 'accounts.INVALID_ACCOUNT_VALUE',
          issues: null,
          requestId: 'request-id',
        },
      })

    renderSignUpForm(<SignUpForm action={signUpAction} />)
    await verifyCaptcha()
    fillCredentials()
    submit()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Use uma senha de 8 a 64 caracteres com letras maiúsculas e minúsculas, número e símbolo.',
    )
  })

  it('resets the security verification after a rejected submission', async () => {
    const signUpAction: SignUpAction = () =>
      Promise.resolve({
        status: 'api-error',
        error: { code: 'accounts.INVALID_ACCOUNT_VALUE', issues: null, requestId: 'request-id' },
      })

    renderSignUpForm(<SignUpForm action={signUpAction} />)
    await verifyCaptcha()
    fillCredentials()
    submit()

    await waitFor(() => {
      expect(resetWidgets).toEqual(['widget-0'])
    })
  })

  it('attaches an API field issue to the field it belongs to', async () => {
    const signUpAction: SignUpAction = () =>
      Promise.resolve({
        status: 'api-error',
        error: {
          code: 'shared.VALIDATION_FAILED',
          issues: [{ field: 'email', message: 'must match format "email"' }],
          requestId: 'request-id',
        },
      })

    renderSignUpForm(<SignUpForm action={signUpAction} />)
    await verifyCaptcha()
    fillCredentials()
    submit()

    expect(await screen.findByText('Informe um e-mail válido.')).toBeInTheDocument()
  })

  it('falls back to a generic toast when the backend error code is unmapped', async () => {
    const signUpAction: SignUpAction = () =>
      Promise.resolve({
        status: 'api-error',
        error: { code: 'accounts.SOME_NEW_ERROR', issues: null, requestId: null },
      })

    renderSignUpForm(<SignUpForm action={signUpAction} />)
    await verifyCaptcha()
    fillCredentials()
    submit()

    expect(
      await screen.findByText('Não foi possível concluir a ação. Tente novamente.'),
    ).toBeInTheDocument()
  })
})

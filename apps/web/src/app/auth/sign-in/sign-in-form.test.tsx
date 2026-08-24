import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { messages } from '@/i18n/messages'

import { SignInForm } from './sign-in-form'
import { initialSignInActionState, type SignInActionState } from './types'

type SignInAction = (state: SignInActionState, formData: FormData) => Promise<SignInActionState>

function renderSignInForm(action: SignInAction) {
  return render(
    <NextIntlClientProvider locale="pt-BR" messages={messages}>
      <SignInForm action={action} />
    </NextIntlClientProvider>,
  )
}

describe('SignInForm', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllEnvs()
  })

  it('submits valid credentials to signInAction', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'https://api.mindness.test')
    const submittedFormData: FormData[] = []
    const signInAction: SignInAction = (_state, formData) => {
      submittedFormData.push(formData)

      return Promise.resolve(initialSignInActionState)
    }

    renderSignInForm(signInAction)

    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'person@example.com' } })
    fireEvent.change(screen.getByLabelText('Senha'), {
      target: { value: 'a-valid-password' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Avançar' }))

    await waitFor(() => {
      expect(submittedFormData).toHaveLength(1)
    })
    expect(submittedFormData[0]?.get('email')).toBe('person@example.com')
  })

  it('shows the authentication rejection message returned by the action', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'https://api.mindness.test')
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

    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'person@example.com' } })
    fireEvent.change(screen.getByLabelText('Senha'), {
      target: { value: 'a-valid-password' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Avançar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou senha incorretos.')
  })

  it('links to the Google authorization endpoint', () => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'https://api.mindness.test')

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

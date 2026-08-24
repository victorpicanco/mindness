import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import type { ReactElement } from 'react'
import { Toaster } from 'sonner'
import { afterEach, describe, expect, it } from 'vitest'

import { messages } from '@/i18n/messages'

import { SignUpForm } from './sign-up-form'
import { initialSignUpActionState, type SignUpActionState } from './types'

type SignUpAction = (state: SignUpActionState, formData: FormData) => Promise<SignUpActionState>

function validSignUpAction(): SignUpAction {
  return () =>
    Promise.resolve({
      status: 'success',
      messageKey: 'signUp.success',
    })
}

function renderSignUpForm(element: ReactElement) {
  return render(
    <NextIntlClientProvider locale="pt-BR" messages={messages}>
      <Toaster />
      {element}
    </NextIntlClientProvider>,
  )
}

describe('SignUpForm', () => {
  afterEach(cleanup)

  it('submits valid credentials and shows the email confirmation state', async () => {
    const submittedFormData: FormData[] = []
    const signUpAction: SignUpAction = async (state, formData) => {
      submittedFormData.push(formData)

      return validSignUpAction()(state, formData)
    }

    renderSignUpForm(<SignUpForm action={signUpAction} />)

    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'person@example.com' } })
    fireEvent.change(screen.getByLabelText('Senha'), {
      target: { value: 'a-valid-password' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }))

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Verifique seu e-mail para continuar.')
    })

    expect(submittedFormData).toHaveLength(1)
    expect(submittedFormData[0]?.get('email')).toBe('person@example.com')
  })

  it('announces invalid email and password values through their fields without submitting', () => {
    let submissions = 0
    const signUpAction: SignUpAction = () => {
      submissions += 1

      return Promise.resolve(initialSignUpActionState)
    }

    renderSignUpForm(<SignUpForm action={signUpAction} />)

    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'invalid' } })
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'short' } })
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Informe um e-mail válido.')
    expect(screen.getByLabelText('E-mail')).toHaveAttribute('aria-invalid', 'true')
    expect(submissions).toBe(0)
  })

  it('shows a translated toast when the backend rejects account creation', async () => {
    const signUpAction: SignUpAction = () =>
      Promise.resolve({
        status: 'api-error',
        error: {
          code: 'accounts.ACCOUNT_CREATION_REJECTED',
          issues: null,
          requestId: 'request-id',
        },
      })

    renderSignUpForm(<SignUpForm action={signUpAction} />)

    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'person@example.com' } })
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'a-valid-password' } })
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }))

    expect(
      await screen.findByText(
        'Verifique seu e-mail para continuar, caso exista uma conta elegível para este endereço.',
      ),
    ).toBeInTheDocument()
  })

  it('falls back to a generic toast when the backend error code is unmapped', async () => {
    const signUpAction: SignUpAction = () =>
      Promise.resolve({
        status: 'api-error',
        error: { code: 'accounts.SOME_NEW_ERROR', issues: null, requestId: null },
      })

    renderSignUpForm(<SignUpForm action={signUpAction} />)

    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'person@example.com' } })
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'a-valid-password' } })
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }))

    expect(
      await screen.findByText('Não foi possível concluir a ação. Tente novamente.'),
    ).toBeInTheDocument()
  })
})

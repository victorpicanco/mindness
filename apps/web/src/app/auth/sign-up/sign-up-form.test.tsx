import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { SignUpForm } from './sign-up-form'
import { initialSignUpActionState, type SignUpActionState } from './types'

type SignUpAction = (state: SignUpActionState, formData: FormData) => Promise<SignUpActionState>

function validSignUpAction(): SignUpAction {
  return () =>
    Promise.resolve({
      status: 'success',
      message: 'Verifique seu e-mail para continuar.',
    })
}

describe('SignUpForm', () => {
  afterEach(cleanup)

  it('submits valid credentials and shows the email confirmation state', async () => {
    const submittedFormData: FormData[] = []
    const signUpAction: SignUpAction = async (state, formData) => {
      submittedFormData.push(formData)

      return validSignUpAction()(state, formData)
    }

    render(<SignUpForm action={signUpAction} />)

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

    render(<SignUpForm action={signUpAction} />)

    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'invalid' } })
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'short' } })
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Informe um e-mail válido.')
    expect(screen.getByLabelText('E-mail')).toHaveAttribute('aria-invalid', 'true')
    expect(submissions).toBe(0)
  })
})

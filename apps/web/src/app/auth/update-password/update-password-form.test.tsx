import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { messages } from '@/i18n/messages'

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

import { initialAuthActionState, type AuthActionState } from '../auth-action-state'

import { UpdatePasswordForm } from './update-password-form'

type UpdatePasswordAction = (state: AuthActionState, formData: FormData) => Promise<AuthActionState>

function renderForm(action: UpdatePasswordAction) {
  return render(
    <NextIntlClientProvider locale="pt-BR" messages={messages}>
      <UpdatePasswordForm action={action} />
    </NextIntlClientProvider>,
  )
}

function fillPassword(value: string): void {
  fireEvent.change(screen.getByLabelText('Senha'), { target: { value } })
}

function submit(): void {
  fireEvent.click(screen.getByRole('button', { name: 'Salvar nova senha' }))
}

beforeEach(async () => {
  const { toast } = await import('sonner')
  vi.mocked(toast.error).mockClear()
})

afterEach(cleanup)

describe('UpdatePasswordForm', () => {
  it('holds a password that does not meet the policy before calling the action', () => {
    const calls: FormData[] = []

    renderForm((_state, formData) => {
      calls.push(formData)

      return Promise.resolve(initialAuthActionState)
    })
    fillPassword('alllowercase1')
    submit()

    expect(
      screen.getByText(
        'Use uma senha de 8 a 64 caracteres com letras maiúsculas e minúsculas, número e símbolo.',
      ),
    ).toBeInTheDocument()
    expect(calls).toEqual([])
  })

  it('shows the same password requirements the sign-up form shows', () => {
    renderForm(() => Promise.resolve(initialAuthActionState))

    expect(screen.getByLabelText('Requisitos da senha')).toBeInTheDocument()
    expect(screen.getByText('Um símbolo')).toBeInTheDocument()
  })

  it('submits a password that meets the policy', async () => {
    const calls: FormData[] = []

    renderForm((_state, formData) => {
      calls.push(formData)

      return Promise.resolve(initialAuthActionState)
    })
    fillPassword('New_password1!')
    submit()

    await waitFor(() => {
      expect(calls).toHaveLength(1)
    })
    expect(calls[0]?.get('password')).toBe('New_password1!')
  })

  it('raises a transport failure as a toast instead of blaming the password', async () => {
    const { toast } = await import('sonner')

    renderForm(() =>
      Promise.resolve<AuthActionState>({
        status: 'api-error',
        error: { code: 'web.API_REQUEST_FAILED', issues: null, requestId: null },
      }),
    )
    fillPassword('New_password1!')
    submit()

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'Não foi possível conectar ao servidor. Verifique sua conexão.',
      )
    })
    expect(
      screen.queryByText(
        'Use uma senha de 8 a 64 caracteres com letras maiúsculas e minúsculas, número e símbolo.',
      ),
    ).not.toBeInTheDocument()
  })
})

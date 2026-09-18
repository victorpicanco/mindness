import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AlertDialogProvider } from '@/components/providers/alert-dialog-provider'
import { messages } from '@/i18n/messages'
import { dismissAlertDialog } from '@/lib/feedback/alert-dialog'

const push = vi.fn()

vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))

import { ExpiredRecoveryLink } from './index'

afterEach(() => {
  act(() => {
    dismissAlertDialog()
  })
  cleanup()
  push.mockClear()
})

function renderNotice() {
  return render(
    <NextIntlClientProvider locale="pt-BR" messages={messages}>
      <ExpiredRecoveryLink />
      <AlertDialogProvider />
    </NextIntlClientProvider>,
  )
}

describe('ExpiredRecoveryLink', () => {
  it('interrupts the recovery flow with a dialog instead of an inline failure', () => {
    renderNotice()

    expect(
      screen.getByRole('dialog', { name: 'Não foi possível continuar' }),
    ).toHaveAccessibleDescription('Este link de recuperação expirou ou já foi utilizado.')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('takes the user to a fresh recovery request', () => {
    renderNotice()

    fireEvent.click(screen.getByRole('button', { name: 'Solicitar outro link' }))

    expect(push).toHaveBeenCalledWith('/auth/password-recovery')
  })
})

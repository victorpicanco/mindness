import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { messages } from '@/i18n/messages'
import {
  dismissAlertDialog,
  showAlertDialog,
  type AlertDialogRequest,
} from '@/lib/feedback/alert-dialog'

import { AlertDialogProvider } from './index'

afterEach(() => {
  act(() => {
    dismissAlertDialog()
  })
  cleanup()
})

function announce(request: AlertDialogRequest): void {
  act(() => {
    showAlertDialog(request)
  })
}

function renderProvider() {
  return render(
    <NextIntlClientProvider locale="pt-BR" messages={messages}>
      <AlertDialogProvider />
    </NextIntlClientProvider>,
  )
}

describe('AlertDialogProvider', () => {
  it('stays out of the way while there is nothing to announce', () => {
    renderProvider()

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('announces the request as a modal the user has to acknowledge', () => {
    renderProvider()
    announce({ description: 'O link expirou.', title: 'Link inválido' })

    expect(screen.getByRole('dialog', { name: 'Link inválido' })).toHaveAccessibleDescription(
      'O link expirou.',
    )
  })

  it('closes on the acknowledgement button when the failure leaves no choice', () => {
    renderProvider()
    announce({ description: 'O link expirou.', title: 'Link inválido' })

    fireEvent.click(screen.getByRole('button', { name: 'Entendi' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('offers the choices the request carries instead of a plain acknowledgement', () => {
    const onSelect = vi.fn()

    renderProvider()
    announce({
      actions: [{ label: 'Tentar de novo', onSelect }],
      description: 'O envio falhou.',
      title: 'Envio interrompido',
    })

    expect(screen.queryByRole('button', { name: 'Entendi' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))

    expect(onSelect).toHaveBeenCalledOnce()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('refuses to close a decision the user still has to make', () => {
    renderProvider()
    announce({
      actions: [{ label: 'Tentar de novo', onSelect: () => undefined }],
      description: 'O envio falhou.',
      title: 'Envio interrompido',
    })

    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }))

    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('replaces the open request with the newest one', () => {
    renderProvider()
    announce({ description: 'Primeira.', title: 'Primeira' })
    announce({ description: 'Segunda.', title: 'Segunda' })

    expect(screen.getByRole('dialog', { name: 'Segunda' })).toBeInTheDocument()
  })
})

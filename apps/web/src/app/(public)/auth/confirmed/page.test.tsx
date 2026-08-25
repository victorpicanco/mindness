import { cleanup, render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { messages } from '@/i18n/messages'

vi.mock('next/font/google', () => ({
  Buenard: () => ({ variable: '--font-buenard' }),
}))

import { ConfirmedScreen } from './page'

describe('ConfirmedPage', () => {
  afterEach(cleanup)

  it('confirms the email and offers the way into sign-in', () => {
    render(
      <NextIntlClientProvider locale="pt-BR" messages={messages}>
        <ConfirmedScreen status="success" />
      </NextIntlClientProvider>,
    )

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('E-mail confirmado.')
    expect(screen.getByRole('link', { name: 'Ir para o login' })).toHaveAttribute(
      'href',
      '/auth/sign-in',
    )
  })

  it('explains an expired or already-used link without claiming success', () => {
    render(
      <NextIntlClientProvider locale="pt-BR" messages={messages}>
        <ConfirmedScreen status="invalid" />
      </NextIntlClientProvider>,
    )

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Este link não é mais válido.',
    )
    expect(screen.getByRole('link', { name: 'Reenviar confirmação' })).toHaveAttribute(
      'href',
      '/auth/resend-confirmation',
    )
  })
})

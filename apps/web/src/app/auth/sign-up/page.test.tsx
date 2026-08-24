import { cleanup, render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { messages } from '@/i18n/messages'

vi.mock('next/font/google', () => ({
  Buenard: () => ({ variable: '--font-buenard' }),
}))

import SignUpPage from './page'

describe('SignUpPage', () => {
  afterEach(cleanup)

  it('uses the authentication layout and provides a link back to sign in', () => {
    render(
      <NextIntlClientProvider locale="pt-BR" messages={messages}>
        <SignUpPage />
      </NextIntlClientProvider>,
    )

    expect(screen.getByRole('main')).toHaveClass('lg:grid', 'lg:grid-cols-2')
    expect(screen.getByText('Mindness')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Entre agora.' })).toHaveAttribute(
      'href',
      '/auth/sign-in',
    )
    expect(screen.getByLabelText('Imagem do Mindness')).toBeInTheDocument()
  })
})

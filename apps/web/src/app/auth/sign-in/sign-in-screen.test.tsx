import { cleanup, render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { messages } from '@/i18n/messages'

vi.mock('next/font/google', () => ({
  Buenard: () => ({ variable: '--font-buenard' }),
}))

import { SignInScreen } from './sign-in-screen'

function renderSignInScreen(element: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="pt-BR" messages={messages}>
      {element}
    </NextIntlClientProvider>,
  )
}

describe('SignInScreen', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', 'site-key')
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllEnvs()
  })

  it('uses the authentication layout and provides a link to sign up', () => {
    renderSignInScreen(<SignInScreen />)

    expect(screen.getByRole('main')).toHaveClass('lg:grid', 'lg:grid-cols-2')
    expect(screen.getByRole('link', { name: 'Crie agora.' })).toHaveAttribute(
      'href',
      '/auth/sign-up',
    )
    expect(screen.getByLabelText('Imagem do Mindness')).toBeInTheDocument()
  })

  it('announces the failure the callback reported', () => {
    renderSignInScreen(<SignInScreen errorMessageKey="auth.errors.googleSignInFailed" />)

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Não foi possível entrar com o Google. Tente novamente.',
    )
  })
})

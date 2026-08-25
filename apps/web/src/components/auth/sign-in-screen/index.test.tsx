import { cleanup, render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { messages } from '@/i18n/messages'
import { initialAuthActionState } from '@/lib/auth/action-state'

vi.mock('next/font/google', () => ({
  Buenard: () => ({ variable: '--font-buenard' }),
}))

import { SignInScreen } from './index'

const signInAction = () => Promise.resolve(initialAuthActionState)

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
    renderSignInScreen(<SignInScreen action={signInAction} />)

    expect(screen.getByRole('main')).toHaveClass(
      'lg:grid',
      'lg:grid-cols-2',
      'lg:h-screen',
      'lg:overflow-hidden',
    )
    expect(screen.getByRole('main').querySelector('section')).toHaveClass(
      'lg:min-h-0',
      'lg:overflow-y-auto',
      'lg:[scrollbar-width:none]',
      'lg:[&::-webkit-scrollbar]:hidden',
    )
    expect(screen.getByRole('link', { name: 'Crie agora.' })).toHaveAttribute(
      'href',
      '/auth/sign-up',
    )
    expect(screen.getByLabelText('Imagem do Mindness')).toBeInTheDocument()
  })

  it('shows an inline failure the callback reported', () => {
    renderSignInScreen(
      <SignInScreen
        action={signInAction}
        initialError={{ messageKey: 'auth.errors.betaCapacityReached', presentation: 'inline' }}
      />,
    )

    expect(screen.getByRole('alert')).toHaveTextContent(
      'O beta atingiu o limite de contas. Avisaremos quando abrirem novas vagas.',
    )
  })
})

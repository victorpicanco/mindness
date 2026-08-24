import { cleanup, render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { afterEach, describe, expect, it } from 'vitest'

import { messages } from '@/i18n/messages'

import { SignInShowcase } from './index'

function renderSignInShowcase() {
  return render(
    <NextIntlClientProvider locale="pt-BR" messages={messages}>
      <SignInShowcase />
    </NextIntlClientProvider>,
  )
}

describe('SignInShowcase', () => {
  afterEach(() => {
    cleanup()
  })

  it('displays the static showcase image', () => {
    renderSignInShowcase()

    expect(screen.getByRole('img', { name: 'Palestrante em um palco' })).toBeVisible()
  })

  it('exposes an accessible label for the showcase region', () => {
    renderSignInShowcase()

    expect(screen.getByRole('region', { name: 'Imagem do Mindness' })).toBeInTheDocument()
  })
})

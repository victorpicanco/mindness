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

  it('overlays the brand message on the showcase image', () => {
    const { container } = renderSignInShowcase()

    const message = container.querySelector('[data-split-text="words"]')

    expect(message).toHaveClass(
      'font-(family-name:--font-buenard)',
      'font-normal',
      'text-[clamp(2rem,3vw,3.5rem)]',
      'whitespace-pre',
    )
    expect(message).toHaveTextContent('Melhore sua comunicação enquanto fica mais inteligente.')
    expect(container.querySelectorAll('[data-split-word]').length).toBeGreaterThan(0)
  })
})

import { cleanup, render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { afterEach, describe, expect, it } from 'vitest'

import { messages } from '@/i18n/messages'

import { Providers } from './providers'

describe('Providers', () => {
  afterEach(cleanup)

  it('renders children inside the application providers', () => {
    expect(() =>
      render(
        <NextIntlClientProvider locale="pt-BR" messages={messages}>
          <Providers>
            <p>Provider child</p>
          </Providers>
        </NextIntlClientProvider>,
      ),
    ).not.toThrow()

    expect(screen.getByText('Provider child')).toBeInTheDocument()
  })
})

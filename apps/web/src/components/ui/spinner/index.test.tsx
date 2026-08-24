import { render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { describe, expect, it } from 'vitest'

import { Spinner } from './index'
import { messages } from '@/i18n/messages'

describe('Spinner', () => {
  it('exposes an accessible status message', () => {
    render(
      <NextIntlClientProvider locale="pt-BR" messages={messages}>
        <Spinner />
      </NextIntlClientProvider>,
    )

    expect(screen.getByRole('status', { name: 'Carregando' })).toBeInTheDocument()
    expect(screen.getByText('Carregando')).toHaveClass('sr-only')
  })
})

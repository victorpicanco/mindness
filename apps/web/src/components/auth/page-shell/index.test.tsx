import { cleanup, render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { messages } from '@/i18n/messages'

vi.mock('next/font/google', () => ({
  Buenard: () => ({ variable: '--font-buenard' }),
}))

import { AuthPageShell } from './index'

function renderShell() {
  return render(
    <NextIntlClientProvider locale="pt-BR" messages={messages}>
      <AuthPageShell description="Informe seu e-mail." title="Recupere seu acesso.">
        <p>form</p>
      </AuthPageShell>
    </NextIntlClientProvider>,
  )
}

describe('AuthPageShell', () => {
  afterEach(cleanup)

  it('drops the showcase image without moving the content off the left column', () => {
    renderShell()

    expect(screen.queryByRole('region', { name: 'Imagem do Mindness' })).toBeNull()
    expect(screen.queryByRole('img', { name: 'Palestrante em um palco' })).toBeNull()
    expect(screen.getByRole('main')).toHaveClass('lg:grid', 'lg:grid-cols-2')
  })

  it('shows the brand, the title, the description and the form', () => {
    renderShell()

    expect(screen.getByRole('link', { name: 'Mindness' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Recupere seu acesso.')
    expect(screen.getByText('Informe seu e-mail.')).toBeInTheDocument()
    expect(screen.getByText('form')).toBeInTheDocument()
  })
})

import { cleanup, render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { afterEach, describe, expect, it } from 'vitest'

import HomePage from './page'
import { messages } from '@/i18n/messages'

function renderHomePage() {
  return render(
    <NextIntlClientProvider locale="pt-BR" messages={messages}>
      <HomePage />
    </NextIntlClientProvider>,
  )
}

describe('HomePage', () => {
  afterEach(cleanup)

  it('renders the main heading', () => {
    renderHomePage()

    expect(screen.getByRole('heading', { level: 1, name: 'Mindness' })).toBeInTheDocument()
  })

  it('shows the temporary component showcase', () => {
    renderHomePage()

    expect(screen.getByRole('heading', { level: 2, name: 'Botões' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Campos e seleção' })).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 2, name: 'Superfície e feedback' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Primário' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Carregando' })).toBeDisabled()
    expect(screen.getByRole('combobox', { name: 'Categoria' })).toBeInTheDocument()
    expect(screen.getAllByRole('status')).not.toHaveLength(0)
  })
})

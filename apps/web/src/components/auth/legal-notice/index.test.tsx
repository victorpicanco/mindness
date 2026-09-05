import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { afterEach, describe, expect, it } from 'vitest'

import { messages } from '@/i18n/messages'

import { LegalNotice } from './index'

function renderLegalNotice() {
  return render(
    <NextIntlClientProvider locale="pt-BR" messages={messages}>
      <LegalNotice />
    </NextIntlClientProvider>,
  )
}

describe('LegalNotice', () => {
  afterEach(cleanup)

  it('opens one legal dialog from the terms and privacy link', () => {
    renderLegalNotice()

    fireEvent.click(screen.getByRole('button', { name: 'Termos de Uso e Privacidade' }))

    const dialog = screen.getByRole('dialog', { name: 'Termos de Uso e Privacidade' })
    const navigation = within(dialog).getByRole('navigation', {
      name: 'Termos de Uso e Privacidade',
    })
    const privacyItem = within(navigation).getByRole('button', {
      name: 'Política de Privacidade',
    })

    expect(dialog).toHaveAttribute('open')
    expect(dialog).toHaveClass('backdrop:bg-black/30', 'dark:backdrop:bg-black/60')
    expect(navigation).toHaveClass('overflow-x-auto', 'md:flex-col', 'md:overflow-x-visible')
    expect(privacyItem).toHaveAttribute('aria-current', 'page')
    expect(
      within(dialog).getByRole('region', { name: 'Política de Privacidade' }),
    ).toHaveTextContent('Supabase')
  })

  it('switches to the terms of use from the responsive navigation', () => {
    renderLegalNotice()
    fireEvent.click(screen.getByRole('button', { name: 'Termos de Uso e Privacidade' }))

    const dialog = screen.getByRole('dialog', { name: 'Termos de Uso e Privacidade' })
    const navigation = within(dialog).getByRole('navigation', {
      name: 'Termos de Uso e Privacidade',
    })
    const termsItem = within(navigation).getByRole('button', { name: 'Termos de Uso' })

    fireEvent.click(termsItem)

    expect(termsItem).toHaveAttribute('aria-current', 'page')
    expect(within(dialog).getByRole('region', { name: 'Termos de Uso' })).toHaveTextContent(
      'prática de comunicação',
    )
    expect(
      within(dialog).queryByRole('region', { name: 'Política de Privacidade' }),
    ).not.toBeInTheDocument()
  })

  it('closes from its close control and Escape', () => {
    renderLegalNotice()
    const trigger = screen.getByRole('button', { name: 'Termos de Uso e Privacidade' })
    fireEvent.click(trigger)

    fireEvent.click(screen.getByRole('button', { name: 'Fechar termos e privacidade' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    fireEvent.click(trigger)
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

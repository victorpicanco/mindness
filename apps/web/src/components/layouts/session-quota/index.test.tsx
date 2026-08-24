import { cleanup, render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { afterEach, describe, expect, it } from 'vitest'

import { messages } from '@/i18n/messages'

import { SessionQuota } from './index'

function renderSessionQuota(remaining: number) {
  return render(
    <NextIntlClientProvider locale="pt-BR" messages={messages}>
      <SessionQuota allowance={4} remaining={remaining} renewsAt="2026-08-24T12:05:00.000Z" />
    </NextIntlClientProvider>,
  )
}

describe('SessionQuota', () => {
  afterEach(cleanup)

  it('shows the remaining sessions in an outlined status cell', () => {
    renderSessionQuota(4)

    expect(screen.getByLabelText('Cota de sessões')).toHaveClass('border', 'border-border')
    expect(screen.getByText('4/4 sessões restantes')).toBeInTheDocument()
  })

  it('shows the renewal time after the quota is exhausted', () => {
    renderSessionQuota(0)

    const time = new Intl.DateTimeFormat('pt-BR', {
      hour: '2-digit',
      hour12: false,
      minute: '2-digit',
    }).format(new Date('2026-08-24T12:05:00.000Z'))

    expect(screen.getByText(`Renova em ${time}`)).toBeInTheDocument()
  })
})

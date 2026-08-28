import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { SessionQuota } from './index'

function renderSessionQuota(value: string) {
  return render(<SessionQuota label="Cota de sessões" value={value} />)
}

describe('SessionQuota', () => {
  afterEach(cleanup)

  it('shows the remaining sessions in an outlined status cell', () => {
    renderSessionQuota('4/4 sessões restantes')

    expect(screen.getByLabelText('Cota de sessões')).toHaveClass('border', 'border-border')
    expect(screen.getByText('4/4 sessões restantes')).toBeInTheDocument()
  })

  it('shows the renewal time after the quota is exhausted', () => {
    const time = new Intl.DateTimeFormat('pt-BR', {
      hour: '2-digit',
      hour12: false,
      minute: '2-digit',
    }).format(new Date('2026-08-24T12:05:00.000Z'))

    renderSessionQuota(`Renova em ${time}`)

    expect(screen.getByText(`Renova em ${time}`)).toBeInTheDocument()
  })
})

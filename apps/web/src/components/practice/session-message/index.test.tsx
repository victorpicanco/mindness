import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { SessionMessage } from './index'

describe('SessionMessage', () => {
  afterEach(cleanup)

  it('renders an assistant answer directly on the page, without a surface around it', () => {
    render(
      <SessionMessage label="Mensagem da Mindness" sender="assistant">
        <p>Resposta</p>
      </SessionMessage>,
    )

    expect(screen.getByText('Resposta').parentElement).toBe(
      screen.getByRole('article', { name: 'Mensagem da Mindness' }),
    )
    expect(screen.getByRole('article', { name: 'Mensagem da Mindness' })).not.toHaveAttribute(
      'style',
    )
  })

  it('keeps the user message inside its own bubble', () => {
    render(
      <SessionMessage label="Sua mensagem" sender="user">
        <p>Pergunta</p>
      </SessionMessage>,
    )

    expect(screen.getByText('Pergunta').parentElement).not.toBe(
      screen.getByRole('article', { name: 'Sua mensagem' }),
    )
  })
})

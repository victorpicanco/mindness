import { cleanup, render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { afterEach, describe, expect, it } from 'vitest'

import { messages } from '@/i18n/messages'
import { sessionAnalysisSchema } from '@/lib/api/contracts/sessions'

import { AnalysisMessage } from './index'

const ANALYSIS = sessionAnalysisSchema.parse({
  analyzedAt: '2026-08-24T12:10:00.000Z',
  guidance: [
    { pillar: 'clarity', text: 'Organize a ideia central antes de apresentar os detalhes.' },
    { pillar: 'fluency', text: 'Reduza as pausas entre frases relacionadas.' },
  ],
  scores: { clarity: 70, fluency: 60, mastery: 85, rhythm: 75, total: 73 },
  sessionId: '7d5f46c9-3cbd-4c6d-84aa-66b8148a91aa',
  transcript: '<strong>Texto puro</strong> **sem Markdown renderizado**',
})

describe('AnalysisMessage', () => {
  afterEach(cleanup)

  it('presents scores, guidance and transcript as an assistant message', () => {
    const { container } = render(
      <NextIntlClientProvider locale="pt-BR" messages={messages}>
        <AnalysisMessage analysis={ANALYSIS} />
      </NextIntlClientProvider>,
    )

    expect(screen.getByRole('heading', { name: 'Sua análise' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Sua análise' })).not.toHaveAttribute(
      'data-split-text',
    )
    expect(screen.getByLabelText('Mensagem da Mindness')).toBeInTheDocument()
    expect(screen.getByText('73')).toBeInTheDocument()
    expect(screen.getByText('Reduza as pausas entre frases relacionadas.')).toBeInTheDocument()
    expect(
      screen.getByText('<strong>Texto puro</strong> **sem Markdown renderizado**'),
    ).toBeInTheDocument()
    expect(container.querySelector('strong')).not.toBeInTheDocument()
  })
})

import { cleanup, render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { afterEach, describe, expect, it } from 'vitest'

import { messages } from '@/i18n/messages'
import { sessionAnalysisSchema } from '@/lib/api/contracts/sessions'

import { AnalysisMessage } from './index'

function revealedText(container: HTMLElement): string[] {
  return [...container.querySelectorAll('[data-split-text="words"]')].map(
    (paragraph) => paragraph.textContent ?? '',
  )
}

const ANALYSIS = sessionAnalysisSchema.parse({
  analyzedAt: '2026-08-24T12:10:00.000Z',
  feedback: {
    summary: 'A mensagem ficou clara e direta.',
    strengths: [{ title: 'Abertura direta', evidence: 'A ideia principal aparece no início.' }],
    improvements: [
      {
        title: 'Fechamento mais firme',
        evidence: 'A última frase perde energia.',
        action: 'Repita a mensagem principal em uma frase.',
      },
    ],
  },
  sessionId: '7d5f46c9-3cbd-4c6d-84aa-66b8148a91aa',
  transcript: '<strong>Texto puro</strong> **sem Markdown renderizado**',
})

describe('AnalysisMessage', () => {
  afterEach(cleanup)

  it('presents the summary, strengths, improvements and transcript', () => {
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
    expect(revealedText(container)).toContain('A mensagem ficou clara e direta.')
    expect(screen.getByRole('heading', { name: 'Pontos fortes' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Próximos passos' })).toBeInTheDocument()
    expect(revealedText(container)).toContain('Repita a mensagem principal em uma frase.')
    expect(revealedText(container)).toContain(
      '<strong>Texto puro</strong> **sem Markdown renderizado**',
    )
    expect(container.querySelector('strong')).not.toBeInTheDocument()
  })

  it('does not render scores or empty product sections', () => {
    const { container } = render(
      <NextIntlClientProvider locale="pt-BR" messages={messages}>
        <AnalysisMessage analysis={ANALYSIS} />
      </NextIntlClientProvider>,
    )

    expect(container.querySelectorAll('[data-score-arc="value"]')).toHaveLength(0)
    expect(screen.queryByText('Pontuações')).not.toBeInTheDocument()
  })
})

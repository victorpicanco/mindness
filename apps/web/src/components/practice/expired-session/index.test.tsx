import { cleanup, render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { afterEach, describe, expect, it } from 'vitest'

import { messages } from '@/i18n/messages'
import type { SessionHistoryItem } from '@/lib/api/contracts/sessions'

import { ExpiredSession } from '@/components/practice/expired-session'

function expiredSession(overrides: Partial<SessionHistoryItem> = {}): SessionHistoryItem {
  return {
    categorySlug: 'focus',
    difficulty: 'balanced',
    localDate: '24/08/2026',
    localTime: '09:00',
    sessionId: '7d5f46c9-3cbd-4c6d-84aa-66b8148a91aa',
    startedAt: '2026-08-24T12:00:00.000Z',
    state: 'expired',
    themeTitle: 'Notícias do dia',
    ...overrides,
  }
}

function renderExpiredSession(session: SessionHistoryItem = expiredSession()) {
  return render(
    <NextIntlClientProvider locale="pt-BR" messages={messages}>
      <ExpiredSession session={session} />
    </NextIntlClientProvider>,
  )
}

describe('ExpiredSession', () => {
  afterEach(cleanup)

  it('keeps the conversation layout of a running session with the countdown at zero', () => {
    renderExpiredSession()

    expect(screen.getByRole('region', { name: 'Conversa da sessão' })).toBeInTheDocument()
    expect(
      screen.getByText('Quero praticar na categoria “focus”, com dificuldade equilibrada.'),
    ).toBeInTheDocument()
    expect(screen.getByText('Prepare uma apresentação sobre este tema:')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Notícias do dia' })).toBeInTheDocument()
    expect(screen.getByRole('timer')).toHaveTextContent('00:00')
    expect(
      screen.getByText('Pesquise os pontos principais e organize uma apresentação objetiva.'),
    ).toBeInTheDocument()
  })

  it('replaces the recorder with the inactivity notice', () => {
    renderExpiredSession()

    expect(screen.queryByRole('group', { name: 'Gravador de áudio' })).not.toBeInTheDocument()
    expect(screen.getByText('Esta sessão foi expirada por inatividade.')).toHaveClass('text-sm')
  })

  it('falls back to the category when the session kept no theme', () => {
    renderExpiredSession(expiredSession({ themeTitle: null }))

    expect(screen.getByRole('heading', { name: 'focus' })).toBeInTheDocument()
  })
})

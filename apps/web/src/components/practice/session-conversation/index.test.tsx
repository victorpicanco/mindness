import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, render, screen } from '@testing-library/react'
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime'
import { NextIntlClientProvider } from 'next-intl'
import { useEffect, type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { messages } from '@/i18n/messages'
import { DEFAULT_TIME_ZONE } from '@/i18n/request'
import { sessionAnalysisSchema } from '@/lib/api/contracts/sessions'
import {
  PracticeSessionProvider,
  usePracticeSessionStore,
} from '@/stores/practice-session/provider'
import type { PracticeSession } from '@/stores/practice-session/store'

import { SessionConversation } from './index'

const SESSION: PracticeSession = {
  configuration: { categorySlug: 'news', difficulty: 'balanced', searchWindowMinutes: 3 },
  createdAt: '2026-08-27T12:00:00.000Z',
  expiresAt: '2026-08-27T12:15:00.000Z',
  recordingStartedAt: '2026-08-27T12:03:00.000Z',
  researchEndsAt: '2026-08-27T12:03:00.000Z',
  sessionId: '7d5f46c9-3cbd-4c6d-84aa-66b8148a91aa',
  themeTitle: 'Notícias do dia',
}

const ANALYSIS = sessionAnalysisSchema.parse({
  analyzedAt: '2026-08-27T12:10:00.000Z',
  guidance: [{ pillar: 'clarity', text: 'Organize a ideia central.' }],
  scores: { clarity: 70, fluency: 60, mastery: 85, rhythm: 75, total: 73 },
  sessionId: SESSION.sessionId,
  transcript: 'Transcrição da apresentação.',
})

function createRouter() {
  return {
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
    push: vi.fn(),
    refresh: vi.fn(),
    replace: vi.fn(),
  }
}

function BeginProcessing({ children }: { readonly children: ReactNode }) {
  const beginProcessing = usePracticeSessionStore((state) => state.beginProcessing)

  useEffect(() => beginProcessing(), [beginProcessing])

  return children
}

function CompleteAnalysis({ children }: { readonly children: ReactNode }) {
  const beginProcessing = usePracticeSessionStore((state) => state.beginProcessing)
  const completeAnalysis = usePracticeSessionStore((state) => state.completeAnalysis)

  useEffect(() => {
    beginProcessing()
    completeAnalysis()
  }, [beginProcessing, completeAnalysis])

  return children
}

function renderConversation(children: ReactNode) {
  render(
    <AppRouterContext.Provider value={createRouter()}>
      <QueryClientProvider client={new QueryClient()}>
        <NextIntlClientProvider locale="pt-BR" messages={messages} timeZone={DEFAULT_TIME_ZONE}>
          <PracticeSessionProvider
            initialState={{ serverTimeOffsetMs: 0, session: SESSION, status: 'uploading' }}
          >
            {children}
          </PracticeSessionProvider>
        </NextIntlClientProvider>
      </QueryClientProvider>
    </AppRouterContext.Provider>,
  )
}

function revealedText(): string[] {
  return [...document.body.querySelectorAll('[data-split-text="words"]')].map(
    (paragraph) => paragraph.textContent ?? '',
  )
}

describe('SessionConversation', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-27T12:05:00.000Z'))
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('presents the captured audio as the next user message while it is uploading', () => {
    renderConversation(<SessionConversation />)

    const uploading = screen.getByRole('status')
    const audioMessage = screen.getByRole('group', { name: 'Áudio enviado' }).closest('article')

    expect(uploading).toHaveTextContent('Enviando áudio…')
    expect(uploading.closest('article')).toBeNull()
    if (audioMessage === null) throw new DOMException('Audio message was not rendered')
    expect(uploading.compareDocumentPosition(audioMessage)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(screen.getByRole('button', { name: 'Iniciar gravação' })).toBeDisabled()
  })

  it('turns the sent audio into a player once the upload finishes', async () => {
    renderConversation(
      <BeginProcessing>
        <SessionConversation />
      </BeginProcessing>,
    )

    expect(screen.getByRole('group', { name: 'Áudio enviado' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reproduzir gravação' })).toBeInTheDocument()

    await act(() => vi.advanceTimersByTimeAsync(500))

    expect(screen.queryByText('Enviando áudio…')).not.toBeInTheDocument()
  })

  it('appends the analysis to the conversation it already holds', () => {
    renderConversation(
      <CompleteAnalysis>
        <SessionConversation analysis={ANALYSIS} />
      </CompleteAnalysis>,
    )

    expect(
      screen.getByText(
        'Quero iniciar uma sessão com 3 minutos de pesquisa, dificuldade equilibrada e categoria “news”.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Notícias do dia' })).toBeInTheDocument()
    expect(screen.getByRole('timer')).toHaveTextContent('00:00')
    expect(screen.getByText('Seu tempo de pesquisa terminou.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reproduzir gravação' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Sua análise' })).toBeInTheDocument()
    expect(revealedText()).toEqual(
      expect.arrayContaining(['Organize a ideia central.', 'Transcrição da apresentação.']),
    )
    expect(screen.getByRole('button', { name: 'Iniciar gravação' })).toBeDisabled()
  })

  it('keeps the analysis status immediately before the response until it is rendered', () => {
    renderConversation(
      <CompleteAnalysis>
        <SessionConversation />
      </CompleteAnalysis>,
    )

    expect(screen.getByRole('status')).toHaveTextContent('Estamos analisando sua apresentação…')
  })
})

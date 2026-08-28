import { QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { NextIntlClientProvider, useTranslations } from 'next-intl'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { messages } from '@/i18n/messages'
import { DEFAULT_TIME_ZONE } from '@/i18n/request'

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

function ApiProviders({ children }: { readonly children: ReactNode }) {
  const translate = useTranslations()
  const [queryClient] = useState(() => createQueryClient(translate))

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
import { ApiClientError } from '@/lib/api/client-error'
import { createQueryClient } from '@/lib/api/query-client'
import {
  PracticeSessionProvider,
  usePracticeSessionStore,
} from '@/stores/practice-session/provider'

import {
  PracticeConfigForm,
  type PracticeQuota,
  type StartSessionInput,
  type StartSessionRequest,
} from '@/components/practice/config-form'

const CATEGORIES = [
  { categoryId: '7d5f46c9-3cbd-4c6d-84aa-66b8148a91aa', name: 'Foco', slug: 'focus' },
]

const QUOTA: PracticeQuota = { allowance: 4, renewsAt: '2026-09-01T12:05:00.000Z' }

const STARTED_SESSION = {
  createdAt: '2026-08-24T12:00:00.000Z',
  expiresAt: '2026-08-24T12:05:00.000Z',
  remaining: 3,
  researchEndsAt: '2026-08-24T12:03:00.000Z',
  serverNow: '2026-08-24T12:00:00.000Z',
  sessionId: '7d5f46c9-3cbd-4c6d-84aa-66b8148a91ab',
  themeId: '7d5f46c9-3cbd-4c6d-84aa-66b8148a91aa',
  themeTitle: 'Comunicação clara',
}

function PracticeSessionProbe() {
  const status = usePracticeSessionStore((state) => state.status)
  const session = usePracticeSessionStore((state) => state.session)

  return (
    <dl>
      <dt>status</dt>
      <dd>{status}</dd>
      <dt>theme</dt>
      <dd>{session === null ? 'none' : session.themeTitle}</dd>
    </dl>
  )
}

function renderPracticeConfigForm(
  startSession: StartSessionRequest,
  onSessionStarted?: (sessionId: string) => void,
  signOut: () => void = () => undefined,
) {
  return render(
    <NextIntlClientProvider locale="pt-BR" messages={messages} timeZone={DEFAULT_TIME_ZONE}>
      <ApiProviders>
        <PracticeSessionProvider>
          <PracticeConfigForm
            categories={CATEGORIES}
            quota={QUOTA}
            signOut={signOut}
            startSession={startSession}
            {...(onSessionStarted === undefined ? {} : { onSessionStarted })}
          />
          <PracticeSessionProbe />
        </PracticeSessionProvider>
      </ApiProviders>
    </NextIntlClientProvider>,
  )
}

function submitConfiguration() {
  fireEvent.change(screen.getByLabelText('Dificuldade'), { target: { value: 'balanced' } })
  fireEvent.change(screen.getByLabelText('Categoria'), { target: { value: 'focus' } })
  fireEvent.change(screen.getByLabelText('Tempo de pesquisa'), { target: { value: '4' } })
  fireEvent.click(screen.getByRole('button', { name: 'Iniciar sessão' }))
}

function rejectingRequest(code: string): StartSessionRequest {
  return () =>
    Promise.reject(
      new ApiClientError({
        code,
        issues: null,
        message: 'The session could not be started.',
        requestId: null,
      }),
    )
}

function renewalDate(renewsAt: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(renewsAt))
}

describe('PracticeConfigForm', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('moves the practice session store to researching with the started session', async () => {
    const requests: StartSessionInput[] = []
    const openedSessions: string[] = []
    const startSession: StartSessionRequest = (input) => {
      requests.push(input)

      return Promise.resolve(STARTED_SESSION)
    }

    renderPracticeConfigForm(startSession, (sessionId) => openedSessions.push(sessionId))
    submitConfiguration()

    await waitFor(() => {
      expect(screen.getByText('researching')).toBeInTheDocument()
    })
    expect(screen.getByText('Comunicação clara')).toBeInTheDocument()
    expect(requests).toEqual([
      { categorySlug: 'focus', difficulty: 'balanced', searchWindowMinutes: 4 },
    ])
    expect(openedSessions).toEqual([STARTED_SESSION.sessionId])
  })

  it('offers the plus plan with the renewal date when the quota is exhausted', async () => {
    renderPracticeConfigForm(rejectingRequest('quota.QUOTA_EXHAUSTED'))
    submitConfiguration()

    const alert = await screen.findByRole('alert')

    expect(alert).toHaveTextContent(`Elas renovam em ${renewalDate(QUOTA.renewsAt)}.`)
    expect(alert).toHaveTextContent('Assine o Plus para praticar sem limite.')
    expect(screen.getByText('idle')).toBeInTheDocument()
  })

  it('explains that no theme is available for the chosen configuration', async () => {
    renderPracticeConfigForm(rejectingRequest('sessions.THEME_UNAVAILABLE'))
    submitConfiguration()

    const alert = await screen.findByRole('alert')

    expect(alert).toHaveTextContent('Não há tema disponível nessa combinação. Escolha outra opção.')
    expect(screen.getByText('idle')).toBeInTheDocument()
  })

  it('asks for the voice consent again without starting the session', async () => {
    renderPracticeConfigForm(rejectingRequest('sessions.PRACTICE_NOT_ALLOWED'))
    submitConfiguration()

    const alert = await screen.findByRole('alert')

    expect(alert).toHaveTextContent('Autorize a gravação e análise de voz para iniciar.')
    expect(screen.getByRole('button', { name: 'Sair e entrar de novo' })).toBeInTheDocument()
    expect(screen.getByText('idle')).toBeInTheDocument()
    expect(screen.getByText('none')).toBeInTheDocument()
  })

  it('toasts a failure that the form has no instruction for', async () => {
    const { toast } = await import('sonner')

    renderPracticeConfigForm(rejectingRequest('sessions.SOME_NEW_FAILURE'))
    submitConfiguration()

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        'Não foi possível concluir a ação. Tente novamente.',
      ),
    )
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByText('idle')).toBeInTheDocument()
  })

  it('keeps a blocking failure inline instead of toasting it', async () => {
    const { toast } = await import('sonner')

    renderPracticeConfigForm(rejectingRequest('sessions.THEME_UNAVAILABLE'))
    submitConfiguration()

    await screen.findByRole('alert')

    expect(toast.error).not.toHaveBeenCalled()
  })

  it('submits the consent retry control to the sign-out action it was given', async () => {
    const signOut = vi.fn()

    renderPracticeConfigForm(rejectingRequest('sessions.PRACTICE_NOT_ALLOWED'), undefined, signOut)
    submitConfiguration()

    fireEvent.click(await screen.findByRole('button', { name: 'Sair e entrar de novo' }))

    expect(signOut).toHaveBeenCalledOnce()
  })
})

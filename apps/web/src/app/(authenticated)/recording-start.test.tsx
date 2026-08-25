import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, render, screen } from '@testing-library/react'
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime'
import { NextIntlClientProvider } from 'next-intl'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { messages } from '@/i18n/messages'
import {
  PracticeSessionProvider,
  usePracticeSessionStore,
} from '@/stores/practice-session/provider'

import { RecordingStart, type RecordingStartProps } from './recording-start'

const NOW = new Date('2026-08-24T12:00:00.000Z')
const SESSION_ID = '7d5f46c9-3cbd-4c6d-84aa-66b8148a91aa'
const GRACE_SECONDS = 120

function PracticeSessionProbe() {
  const status = usePracticeSessionStore((state) => state.status)

  return <output aria-label="practice status">{status}</output>
}

const refreshes: string[] = []

function createRouter() {
  return {
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
    push: vi.fn(),
    refresh: () => refreshes.push('refresh'),
    replace: vi.fn(),
  }
}

function renderRecordingStart(props: RecordingStartProps = {}) {
  return render(
    <AppRouterContext.Provider value={createRouter()}>
      <QueryClientProvider client={new QueryClient()}>
        <NextIntlClientProvider locale="pt-BR" messages={messages}>
          <PracticeSessionProvider
            initialState={{
              session: {
                expiresAt: new Date(NOW.getTime() + GRACE_SECONDS * 1_000).toISOString(),
                researchEndsAt: NOW.toISOString(),
                sessionId: SESSION_ID,
                themeTitle: 'Comunicação clara',
              },
              status: 'awaiting-recording',
            }}
          >
            <RecordingStart {...props} />
            <PracticeSessionProbe />
          </PracticeSessionProvider>
        </NextIntlClientProvider>
      </QueryClientProvider>
    </AppRouterContext.Provider>,
  )
}

function recordingButton(): HTMLElement {
  return screen.getByRole('button', { name: 'Iniciar gravação' })
}

async function advanceBySeconds(seconds: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(seconds * 1_000)
  })
}

async function clickRecordingButton() {
  await act(async () => {
    recordingButton().click()
    await vi.advanceTimersByTimeAsync(0)
  })
}

describe('RecordingStart', () => {
  beforeEach(() => {
    refreshes.length = 0
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('offers an enabled recording button for the two-minute grace', () => {
    renderRecordingStart()

    expect(screen.getByRole('heading', { name: 'Comunicação clara' })).toBeInTheDocument()
    expect(screen.getByRole('timer')).toHaveTextContent('02:00')
    expect(recordingButton()).toBeEnabled()
  })

  it('opens the recording on the server, asks for the microphone and starts recording', async () => {
    const opened: string[] = []
    const microphoneRequests: string[] = []

    renderRecordingStart({
      requestMicrophone: () => {
        microphoneRequests.push('microphone')
        return Promise.resolve()
      },
      startRecording: (sessionId) => {
        opened.push(sessionId)
        return Promise.resolve()
      },
    })

    await clickRecordingButton()

    expect(screen.getByLabelText('practice status')).toHaveTextContent('recording')
    expect(opened).toEqual([SESSION_ID])
    expect(microphoneRequests).toEqual(['microphone'])
  })

  it('expires the session when the grace runs out unused', async () => {
    renderRecordingStart()

    await advanceBySeconds(GRACE_SECONDS)

    expect(screen.getByLabelText('practice status')).toHaveTextContent('expired')
    expect(refreshes).toEqual(['refresh'])
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Sua sessão expirou porque a gravação não começou a tempo.',
    )
    expect(screen.queryByRole('button', { name: 'Iniciar gravação' })).not.toBeInTheDocument()
  })

  it('keeps the session waiting when the microphone is refused', async () => {
    renderRecordingStart({
      requestMicrophone: () => Promise.reject(new DOMException('Denied', 'NotAllowedError')),
      startRecording: () => Promise.resolve(),
    })

    await clickRecordingButton()

    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível acessar o microfone.')
    expect(screen.getByLabelText('practice status')).toHaveTextContent('awaiting-recording')
    expect(recordingButton()).toBeEnabled()
  })
})

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

import { RecordingStart, type RecordingStartProps } from '@/components/practice/recording-start'
import type { AudioLevelSource } from '@/components/practice/use-audio-levels'
import { BAR_INTERVAL_MS } from '@/components/practice/use-audio-levels'
import { MAX_RECORDING_SECONDS } from '@/components/practice/use-recording-clock'

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

function fakeAudioLevelSource() {
  const stop = vi.fn()
  const source: AudioLevelSource = () => Promise.resolve({ read: () => 0.5, stop })

  return { source, stop }
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

function recorder(): HTMLElement {
  return screen.getByRole('group', { name: 'Gravador de áudio' })
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

function grantedMicrophone(source: AudioLevelSource): RecordingStartProps {
  return {
    audioLevelSource: source,
    requestMicrophone: () => Promise.resolve(),
    startRecording: () => Promise.resolve(),
  }
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

  it('offers an enabled recording bar for the two-minute grace', () => {
    const { container } = renderRecordingStart()

    expect(screen.getByRole('heading', { name: 'Comunicação clara' })).toBeInTheDocument()
    expect(screen.getByRole('timer')).toHaveTextContent('02:00')
    expect(recorder()).toHaveAttribute('data-recording-state', 'idle')
    expect(container.querySelectorAll('[data-waveform="bar"]')).toHaveLength(0)
    expect(recordingButton()).toBeEnabled()
  })

  it('opens the recording on the server, asks for the microphone and starts recording', async () => {
    const opened: string[] = []
    const microphoneRequests: string[] = []
    const { source } = fakeAudioLevelSource()

    renderRecordingStart({
      audioLevelSource: source,
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
    expect(recorder()).toHaveAttribute('data-recording-state', 'recording')
    expect(screen.getByRole('button', { name: 'Parar gravação' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: 'Iniciar gravação' })).not.toBeInTheDocument()
    expect(opened).toEqual([SESSION_ID])
    expect(microphoneRequests).toEqual(['microphone'])
  })

  it('draws the captured sound and counts the recording time', async () => {
    const { source } = fakeAudioLevelSource()
    const { container } = renderRecordingStart(grantedMicrophone(source))

    await clickRecordingButton()
    await advanceBySeconds(2)

    expect(container.querySelectorAll('[data-waveform="bar"]').length).toBeGreaterThan(0)
    expect(screen.getByRole('timer')).toHaveTextContent('00:02')
  })

  it('releases the microphone when the recording is stopped by hand', async () => {
    const { source, stop } = fakeAudioLevelSource()
    const { container } = renderRecordingStart(grantedMicrophone(source))

    await clickRecordingButton()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(BAR_INTERVAL_MS * 3)
    })
    act(() => {
      screen.getByRole('button', { name: 'Parar gravação' }).click()
    })

    expect(stop).toHaveBeenCalledOnce()
    expect(container.querySelectorAll('[data-waveform="bar"]')).toHaveLength(0)
    expect(screen.getByRole('button', { name: 'Iniciar gravação' })).toBeDisabled()
  })

  it('stops the recording by itself at the one minute limit', async () => {
    const { source, stop } = fakeAudioLevelSource()
    renderRecordingStart(grantedMicrophone(source))

    await clickRecordingButton()
    await advanceBySeconds(MAX_RECORDING_SECONDS)

    expect(stop).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: 'Iniciar gravação' })).toBeDisabled()
    expect(screen.getByLabelText('practice status')).toHaveTextContent('recording')
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

  it('reports the denied microphone permission, shows the instruction and expires the session', async () => {
    const reports: string[] = []

    renderRecordingStart({
      reportMicrophonePermissionDenied: (sessionId) => {
        reports.push(sessionId)
        return Promise.resolve()
      },
      requestMicrophone: () => Promise.reject(new DOMException('Denied', 'NotAllowedError')),
      startRecording: () => Promise.resolve(),
    })

    await clickRecordingButton()

    expect(reports).toEqual([SESSION_ID])
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Autorize o microfone para gravar sua apresentação.',
    )
    expect(screen.getByLabelText('practice status')).toHaveTextContent('expired')
    expect(screen.queryByRole('button', { name: 'Iniciar gravação' })).not.toBeInTheDocument()
  })

  it('holds the recording bar while the server is opening the recording', async () => {
    let releaseServer: (() => void) | null = null
    const pending = new Promise<void>((resolve) => {
      releaseServer = resolve
    })

    renderRecordingStart({
      requestMicrophone: () => Promise.resolve(),
      startRecording: () => pending,
    })

    await clickRecordingButton()

    expect(recordingButton()).toBeDisabled()

    await act(async () => {
      releaseServer?.()
      await vi.advanceTimersByTimeAsync(0)
    })
  })
})

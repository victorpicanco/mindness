import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, render, screen } from '@testing-library/react'
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime'
import { NextIntlClientProvider } from 'next-intl'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { messages } from '@/i18n/messages'
import { AudioUploadFailedError } from '@/lib/api/audio-upload-failed-error'
import { ApiClientError } from '@/lib/api/client-error'
import type { SubmitRecordingInput } from '@/lib/api/submit-recording'
import {
  PracticeSessionProvider,
  usePracticeSessionStore,
} from '@/stores/practice-session/provider'

import {
  RecordingStart,
  type AudioRecordingSession,
  type RecordingStarted,
  type RecordingStartProps,
  type SubmitRecordingRequest,
} from '@/components/practice/recording-start'
import type { AudioLevelSource } from '@/components/practice/use-audio-levels'
import { BAR_INTERVAL_MS } from '@/components/practice/use-audio-levels'
import { MAX_RECORDING_SECONDS } from '@/components/practice/use-recording-clock'

const NOW = new Date('2026-08-24T12:00:00.000Z')
const SESSION_ID = '7d5f46c9-3cbd-4c6d-84aa-66b8148a91aa'
const GRACE_SECONDS = 120

function PracticeSessionProbe() {
  const status = usePracticeSessionStore((state) => state.status)
  const audioBlob = usePracticeSessionStore((state) => state.audioBlob)
  const session = usePracticeSessionStore((state) => state.session)

  return (
    <>
      <output aria-label="practice status">{status}</output>
      <output aria-label="captured audio">{audioBlob === null ? 'none' : 'retained'}</output>
      <output aria-label="session deadline">{session?.expiresAt ?? 'none'}</output>
    </>
  )
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
      <NextIntlClientProvider locale="pt-BR" messages={messages}>
        <QueryClientProvider client={new QueryClient()}>
          <PracticeSessionProvider
            initialState={{
              serverTimeOffsetMs: 0,
              session: {
                createdAt: NOW.toISOString(),
                expiresAt: new Date(NOW.getTime() + GRACE_SECONDS * 1_000).toISOString(),
                recordingStartedAt: null,
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
        </QueryClientProvider>
      </NextIntlClientProvider>
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

async function settleMutation() {
  for (let i = 0; i < 5; i += 1) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })
  }
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
    requestMicrophone: () => Promise.resolve(undefined),
    startRecording: () =>
      Promise.resolve({
        expiresAt: new Date(NOW.getTime() + GRACE_SECONDS * 1_000).toISOString(),
        recordingStartedAt: NOW.toISOString(),
      }),
  }
}

function fakeAudioCapture(audioBlob: Blob) {
  const stop = vi.fn(() => Promise.resolve(audioBlob))
  const captureRecording = (): Promise<AudioRecordingSession> => Promise.resolve({ stop })

  return { captureRecording, stop }
}

function rejectedAudioSubmission(code: string, requestId: string): SubmitRecordingRequest {
  const error = new ApiClientError({
    code,
    issues: null,
    message: 'The API rejected the audio upload.',
    requestId,
  })

  return () =>
    Promise.resolve().then(() => {
      throw error
    })
}

function pendingSubmission(): {
  submitRecording: (input: SubmitRecordingInput) => Promise<void>
  submitted: SubmitRecordingInput[]
} {
  const submitted: SubmitRecordingInput[] = []

  return {
    submitRecording: (input) => {
      submitted.push(input)
      return new Promise<void>(() => undefined)
    },
    submitted,
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

  it('offers an enabled recording bar for the two-minute grace', async () => {
    const { container } = renderRecordingStart()
    const deadline = new Intl.DateTimeFormat('pt-BR', {
      hour: '2-digit',
      hour12: false,
      minute: '2-digit',
    }).format(new Date(NOW.getTime() + GRACE_SECONDS * 1_000))

    await act(async () => {
      await Promise.resolve()
    })

    expect(screen.getByRole('heading', { name: 'Comunicação clara' })).toBeInTheDocument()
    expect(screen.queryByRole('timer')).not.toBeInTheDocument()
    expect(screen.getByText(`Inicie sua gravação até ${deadline}`)).toBeInTheDocument()
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
        return Promise.resolve(undefined)
      },
      startRecording: (sessionId) => {
        opened.push(sessionId)
        return Promise.resolve({
          expiresAt: new Date(NOW.getTime() + GRACE_SECONDS * 1_000).toISOString(),
          recordingStartedAt: NOW.toISOString(),
        })
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

  it('starts the recorder from the microphone acquisition result', async () => {
    const audioBlob = new Blob(['audio'], { type: 'audio/webm' })
    const { stop } = fakeAudioCapture(audioBlob)
    let capturedStream: MediaStream | undefined

    renderRecordingStart({
      captureRecording: (receivedStream) => {
        capturedStream = receivedStream
        return Promise.resolve({ stop })
      },
      requestMicrophone: () => Promise.resolve(undefined),
      startRecording: () =>
        Promise.resolve({
          expiresAt: new Date(NOW.getTime() + GRACE_SECONDS * 1_000).toISOString(),
          recordingStartedAt: NOW.toISOString(),
        }),
    })

    await clickRecordingButton()

    expect(capturedStream).toBeUndefined()
  })

  it('warns before unloading and abandons the active recording on page exit', async () => {
    const { source } = fakeAudioLevelSource()
    const abandonedSessions: string[] = []
    const view = renderRecordingStart({
      ...grantedMicrophone(source),
      abandonSessionOnPageHide: (sessionId) => {
        abandonedSessions.push(sessionId)
      },
    })

    await clickRecordingButton()

    const beforeUnload = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(beforeUnload)
    window.dispatchEvent(new Event('pagehide'))

    expect(beforeUnload.defaultPrevented).toBe(true)
    expect(abandonedSessions).toEqual([SESSION_ID])

    view.unmount()
    const afterUnmount = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(afterUnmount)

    expect(afterUnmount.defaultPrevented).toBe(false)
  })

  it('uses the deadline returned when the server opens the recording', async () => {
    const { source } = fakeAudioLevelSource()
    const recordingDeadline = new Date(NOW.getTime() + 15 * 60 * 1_000).toISOString()
    renderRecordingStart({
      audioLevelSource: source,
      requestMicrophone: () => Promise.resolve(undefined),
      startRecording: () =>
        Promise.resolve({ expiresAt: recordingDeadline, recordingStartedAt: NOW.toISOString() }),
    })

    await clickRecordingButton()

    expect(screen.getByLabelText('session deadline')).toHaveTextContent(recordingDeadline)
  })

  it('draws the captured sound and counts the recording time', async () => {
    const { source } = fakeAudioLevelSource()
    const { container } = renderRecordingStart(grantedMicrophone(source))

    await clickRecordingButton()
    await advanceBySeconds(2)

    expect(container.querySelectorAll('[data-waveform="bar"]').length).toBeGreaterThan(0)
    expect(screen.getByRole('timer')).toHaveTextContent('00:02')
  })

  it('releases the microphone and uploads the audio when the recording is stopped by hand', async () => {
    const { source, stop } = fakeAudioLevelSource()
    const audioBlob = new Blob(['audio'], { type: 'audio/webm' })
    const { captureRecording } = fakeAudioCapture(audioBlob)
    const { submitRecording, submitted } = pendingSubmission()
    const { container } = renderRecordingStart({
      ...grantedMicrophone(source),
      captureRecording,
      submitRecording,
    })

    await clickRecordingButton()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(BAR_INTERVAL_MS * 3)
    })
    await act(async () => {
      screen.getByRole('button', { name: 'Parar gravação' }).click()
      await vi.advanceTimersByTimeAsync(0)
    })

    expect(stop).toHaveBeenCalledOnce()
    expect(container.querySelectorAll('[data-waveform="bar"]')).toHaveLength(0)
    expect(submitted).toEqual([{ audioBlob, sessionId: SESSION_ID }])
    expect(screen.getByLabelText('practice status')).toHaveTextContent('uploading')
  })

  it('stops the recording by itself at the one minute limit and uploads the audio', async () => {
    const { source, stop } = fakeAudioLevelSource()
    const audioBlob = new Blob(['audio'], { type: 'audio/webm' })
    const { captureRecording } = fakeAudioCapture(audioBlob)
    const { submitRecording, submitted } = pendingSubmission()
    renderRecordingStart({ ...grantedMicrophone(source), captureRecording, submitRecording })

    await clickRecordingButton()
    await advanceBySeconds(MAX_RECORDING_SECONDS)

    expect(stop).toHaveBeenCalledOnce()
    expect(submitted).toEqual([{ audioBlob, sessionId: SESSION_ID }])
    expect(screen.getByLabelText('practice status')).toHaveTextContent('uploading')
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
      startRecording: () =>
        Promise.resolve({
          expiresAt: new Date(NOW.getTime() + GRACE_SECONDS * 1_000).toISOString(),
          recordingStartedAt: NOW.toISOString(),
        }),
    })

    await clickRecordingButton()

    expect(reports).toEqual([SESSION_ID])
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Autorize o microfone para gravar sua apresentação.',
    )
    expect(screen.getByLabelText('practice status')).toHaveTextContent('expired')
    expect(screen.queryByRole('button', { name: 'Iniciar gravação' })).not.toBeInTheDocument()
  })

  it('moves the session to processing once the upload is confirmed', async () => {
    const { source } = fakeAudioLevelSource()
    const audioBlob = new Blob(['audio'], { type: 'audio/webm' })
    const { captureRecording } = fakeAudioCapture(audioBlob)

    renderRecordingStart({
      ...grantedMicrophone(source),
      captureRecording,
      submitRecording: () => Promise.resolve(),
    })

    await clickRecordingButton()
    await advanceBySeconds(MAX_RECORDING_SECONDS)
    await settleMutation()

    expect(screen.getByLabelText('practice status')).toHaveTextContent('processing')
  })

  it('keeps the captured audio and offers retry or discard when the upload fails', async () => {
    const { source } = fakeAudioLevelSource()
    const audioBlob = new Blob(['audio'], { type: 'audio/webm' })
    const { captureRecording } = fakeAudioCapture(audioBlob)

    renderRecordingStart({
      ...grantedMicrophone(source),
      captureRecording,
      submitRecording: () => Promise.reject(new AudioUploadFailedError()),
    })

    await clickRecordingButton()
    await advanceBySeconds(MAX_RECORDING_SECONDS)
    await settleMutation()

    expect(screen.getByLabelText('practice status')).toHaveTextContent('uploading')
    expect(screen.getByLabelText('captured audio')).toHaveTextContent('retained')
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Não foi possível enviar o áudio. Tente novamente.',
    )
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Descartar gravação' })).toBeInTheDocument()
  })

  it('shows the rejected audio size from the API and allows a new recording', async () => {
    const { source } = fakeAudioLevelSource()
    const audioBlob = new Blob(['audio'], { type: 'audio/webm' })
    const { captureRecording } = fakeAudioCapture(audioBlob)

    renderRecordingStart({
      ...grantedMicrophone(source),
      captureRecording,
      submitRecording: rejectedAudioSubmission(
        'sessions.AUDIO_SIZE_REJECTED',
        'audio-size-rejected',
      ),
    })

    await clickRecordingButton()
    await advanceBySeconds(MAX_RECORDING_SECONDS)
    await settleMutation()

    expect(screen.getByRole('alert')).toHaveTextContent(
      'O áudio ficou grande demais para enviar. Grave novamente em uma conexão mais estável.',
    )

    act(() => {
      screen.getByRole('button', { name: 'Descartar gravação' }).click()
    })

    expect(screen.getByLabelText('practice status')).toHaveTextContent('recording')
  })

  it('shows the rejected audio validation from the API and allows a new recording', async () => {
    const { source } = fakeAudioLevelSource()
    const audioBlob = new Blob(['audio'], { type: 'audio/webm' })
    const { captureRecording } = fakeAudioCapture(audioBlob)

    renderRecordingStart({
      ...grantedMicrophone(source),
      captureRecording,
      submitRecording: rejectedAudioSubmission(
        'sessions.AUDIO_VALIDATION_REJECTED',
        'audio-validation-rejected',
      ),
    })

    await clickRecordingButton()
    await advanceBySeconds(MAX_RECORDING_SECONDS)
    await settleMutation()

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Não foi possível validar este áudio. Grave novamente e tente enviar.',
    )

    act(() => {
      screen.getByRole('button', { name: 'Descartar gravação' }).click()
    })

    expect(screen.getByLabelText('practice status')).toHaveTextContent('recording')
  })

  it('shows the failed audio upload from the API and allows a new recording', async () => {
    const { source } = fakeAudioLevelSource()
    const audioBlob = new Blob(['audio'], { type: 'audio/webm' })
    const { captureRecording } = fakeAudioCapture(audioBlob)

    renderRecordingStart({
      ...grantedMicrophone(source),
      captureRecording,
      submitRecording: rejectedAudioSubmission(
        'sessions.AUDIO_UPLOAD_FAILED',
        'audio-upload-failed',
      ),
    })

    await clickRecordingButton()
    await advanceBySeconds(MAX_RECORDING_SECONDS)
    await settleMutation()

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Não foi possível enviar o áudio. Tente novamente.',
    )

    act(() => {
      screen.getByRole('button', { name: 'Descartar gravação' }).click()
    })

    expect(screen.getByLabelText('practice status')).toHaveTextContent('recording')
  })

  it('does not allow starting a second recording while the current one is uploading', async () => {
    const { source } = fakeAudioLevelSource()
    const audioBlob = new Blob(['audio'], { type: 'audio/webm' })
    const { captureRecording } = fakeAudioCapture(audioBlob)
    const { submitRecording } = pendingSubmission()

    renderRecordingStart({ ...grantedMicrophone(source), captureRecording, submitRecording })

    await clickRecordingButton()
    await advanceBySeconds(MAX_RECORDING_SECONDS)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })

    expect(screen.queryByRole('group', { name: 'Gravador de áudio' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Iniciar gravação' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Parar gravação' })).not.toBeInTheDocument()
  })

  it('holds the recording bar while the server is opening the recording', async () => {
    let releaseServer: ((recording: RecordingStarted) => void) | null = null
    const pending = new Promise<RecordingStarted>((resolve) => {
      releaseServer = resolve
    })

    renderRecordingStart({
      requestMicrophone: () => Promise.resolve(undefined),
      startRecording: () => pending,
    })

    await clickRecordingButton()

    expect(recordingButton()).toBeDisabled()

    await act(async () => {
      releaseServer?.({
        expiresAt: new Date(NOW.getTime() + GRACE_SECONDS * 1_000).toISOString(),
        recordingStartedAt: NOW.toISOString(),
      })
      await vi.advanceTimersByTimeAsync(0)
    })
  })
})

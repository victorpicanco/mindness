import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { messages } from '@/i18n/messages'

import { SessionRecorder, type SessionRecorderProps } from '@/components/practice/session-recorder'
import { BAR_INTERVAL_MS, type AudioLevelSource } from '@/components/practice/use-audio-levels'
import { MAX_RECORDING_SECONDS } from '@/components/practice/use-recording-clock'

class FakeMicrophoneError extends Error {
  constructor() {
    super('The fake microphone is unavailable')
    this.name = 'FakeMicrophoneError'
  }
}

function fakeSource() {
  const stop = vi.fn()
  const source: AudioLevelSource = () => Promise.resolve({ read: () => 0.5, stop })

  return { source, stop }
}

function renderRecorder(props: Partial<SessionRecorderProps> = {}) {
  const onLimitReached = vi.fn()
  const onToggleRecording = vi.fn()
  const view = render(
    <NextIntlClientProvider locale="pt-BR" messages={messages}>
      <SessionRecorder
        isRecording={props.isRecording ?? false}
        onLimitReached={props.onLimitReached ?? onLimitReached}
        onToggleRecording={props.onToggleRecording ?? onToggleRecording}
        {...(props.isDisabled === undefined ? {} : { isDisabled: props.isDisabled })}
        {...(props.source === undefined ? {} : { source: props.source })}
      />
    </NextIntlClientProvider>,
  )

  return { ...view, onLimitReached, onToggleRecording }
}

async function advance(milliseconds: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(milliseconds)
  })
}

describe('SessionRecorder', () => {
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('waits with an empty rail and a resting clock', () => {
    const { source } = fakeSource()
    const { container } = renderRecorder({ source })

    expect(screen.getByRole('button', { name: 'Iniciar gravação' })).toBeEnabled()
    expect(container.querySelectorAll('[data-waveform="bar"]')).toHaveLength(0)
    expect(screen.getByText('00:00')).toBeInTheDocument()
  })

  it('counts the recording time up from zero', async () => {
    vi.useFakeTimers()
    const { source } = fakeSource()
    renderRecorder({ isRecording: true, source })

    await advance(3_000)

    expect(screen.getByRole('timer')).toHaveTextContent('00:03')
  })

  it('draws the captured sound while recording', async () => {
    vi.useFakeTimers()
    const { source } = fakeSource()
    const { container } = renderRecorder({ isRecording: true, source })

    await advance(BAR_INTERVAL_MS * 3)

    expect(container.querySelectorAll('[data-waveform="bar"]').length).toBeGreaterThan(0)
  })

  it('reports the one minute limit to the caller', async () => {
    vi.useFakeTimers()
    const { source } = fakeSource()
    const { onLimitReached } = renderRecorder({ isRecording: true, source })

    await advance(MAX_RECORDING_SECONDS * 1_000)

    expect(onLimitReached).toHaveBeenCalledOnce()
  })

  it('releases the microphone when the recording stops', async () => {
    vi.useFakeTimers()
    const { source, stop } = fakeSource()
    const { container, rerender } = renderRecorder({ isRecording: true, source })

    await advance(BAR_INTERVAL_MS * 3)
    rerender(
      <NextIntlClientProvider locale="pt-BR" messages={messages}>
        <SessionRecorder
          isRecording={false}
          onLimitReached={vi.fn()}
          onToggleRecording={vi.fn()}
          source={source}
        />
      </NextIntlClientProvider>,
    )

    expect(stop).toHaveBeenCalledOnce()
    expect(container.querySelectorAll('[data-waveform="bar"]')).toHaveLength(0)
  })

  it('hands the toggle to the caller instead of driving the session itself', () => {
    const { source } = fakeSource()
    const { onToggleRecording } = renderRecorder({ source })

    fireEvent.click(screen.getByRole('button', { name: 'Iniciar gravação' }))

    expect(onToggleRecording).toHaveBeenCalledOnce()
  })

  it('warns when the microphone cannot be opened', async () => {
    const source: AudioLevelSource = () => Promise.reject(new FakeMicrophoneError())
    renderRecorder({ isRecording: true, source })

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível acessar o microfone.')
    })
  })
})

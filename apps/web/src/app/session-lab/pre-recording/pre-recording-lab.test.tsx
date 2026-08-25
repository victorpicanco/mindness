import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { PathnameContext } from 'next/dist/shared/lib/hooks-client-context.shared-runtime'
import { NextIntlClientProvider } from 'next-intl'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { messages } from '@/i18n/messages'

import type { AudioLevelSource } from '@/app/(authenticated)/use-audio-levels'
import { BAR_INTERVAL_MS } from '@/app/(authenticated)/use-audio-levels'

import { PreRecordingLab } from './pre-recording-lab'

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

function renderLab(source: AudioLevelSource) {
  return render(
    <PathnameContext.Provider value="/session-lab/pre-recording">
      <NextIntlClientProvider locale="pt-BR" messages={messages}>
        <PreRecordingLab source={source} />
      </NextIntlClientProvider>
    </PathnameContext.Provider>,
  )
}

async function advance(milliseconds: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(milliseconds)
  })
}

describe('PreRecordingLab', () => {
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('shows the theme over an idle recorder with an empty rail', () => {
    const { source } = fakeSource()
    const { container } = renderLab(source)

    expect(
      screen.getByRole('heading', { name: 'Comunicação clara em conversas difíceis' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Iniciar gravação' })).toBeInTheDocument()
    expect(container.querySelectorAll('[data-waveform="bar"]')).toHaveLength(0)
    expect(screen.getByText('00:00')).toBeInTheDocument()
  })

  it('counts the recording time up from zero', async () => {
    vi.useFakeTimers()
    const { source } = fakeSource()
    renderLab(source)

    fireEvent.click(screen.getByRole('button', { name: 'Iniciar gravação' }))
    await advance(3_000)

    expect(screen.getByRole('timer')).toHaveTextContent('00:03')
  })

  it('stops itself once the recording reaches one minute', async () => {
    vi.useFakeTimers()
    const { source, stop } = fakeSource()
    const { container } = renderLab(source)

    fireEvent.click(screen.getByRole('button', { name: 'Iniciar gravação' }))
    await advance(60_000)

    expect(stop).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: 'Iniciar gravação' })).toBeInTheDocument()
    expect(screen.getByText('00:00')).toBeInTheDocument()
    expect(container.querySelectorAll('[data-waveform="bar"]')).toHaveLength(0)
  })

  it('draws the captured sound while recording and releases the microphone on stop', async () => {
    vi.useFakeTimers()
    const { source, stop } = fakeSource()
    const { container } = renderLab(source)

    fireEvent.click(screen.getByRole('button', { name: 'Iniciar gravação' }))
    await advance(BAR_INTERVAL_MS * 3)

    expect(container.querySelectorAll('[data-waveform="bar"]').length).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('button', { name: 'Parar gravação' }))

    expect(stop).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: 'Iniciar gravação' })).toBeInTheDocument()
    expect(container.querySelectorAll('[data-waveform="bar"]')).toHaveLength(0)
    expect(screen.getByText('00:00')).toBeInTheDocument()
  })

  it('warns when the microphone cannot be opened', async () => {
    const failingSource: AudioLevelSource = () => Promise.reject(new FakeMicrophoneError())
    renderLab(failingSource)

    fireEvent.click(screen.getByRole('button', { name: 'Iniciar gravação' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível acessar o microfone.')
    })
  })
})

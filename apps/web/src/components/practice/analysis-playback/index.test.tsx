import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { messages } from '@/i18n/messages'
import { AudioMessage } from '@/components/practice/audio-message'
import { AnalysisPlaybackProvider, useAnalysisPlayback } from './index'

function SeekButton() {
  const playback = useAnalysisPlayback()
  return (
    <button disabled={!playback?.available} onClick={() => playback?.playFrom(20)}>
      Play moment
    </button>
  )
}

describe('AnalysisPlaybackProvider', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('loads a signed recording lazily and seeks once metadata is ready', async () => {
    const resolveSource = vi.fn(() => Promise.resolve('https://storage.example/audio'))
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
    render(
      <NextIntlClientProvider locale="pt-BR" messages={messages}>
        <AnalysisPlaybackProvider>
          <AudioMessage label="Recording" seed="session" resolveSource={resolveSource} />
          <SeekButton />
        </AnalysisPlaybackProvider>
      </NextIntlClientProvider>,
    )

    expect(resolveSource).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Play moment' }))
    await waitFor(() => expect(play).toHaveBeenCalledOnce())
    const audio = screen.getByLabelText('Gravação da sessão')
    Object.defineProperty(audio, 'duration', { value: 30, configurable: true })
    fireEvent.loadedMetadata(audio)
    expect(audio).toHaveProperty('currentTime', 20)
    expect(resolveSource).toHaveBeenCalledOnce()
  })

  it('keeps a requested position when autoplay is blocked so the user can press play', async () => {
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockRejectedValue(
      new DOMException('Playback blocked', 'NotAllowedError'),
    )
    render(
      <NextIntlClientProvider locale="pt-BR" messages={messages}>
        <AnalysisPlaybackProvider>
          <AudioMessage
            label="Recording"
            seed="session"
            resolveSource={() => Promise.resolve('https://storage.example/audio')}
          />
          <SeekButton />
        </AnalysisPlaybackProvider>
      </NextIntlClientProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Play moment' }))
    const audio = screen.getByLabelText('Gravação da sessão')
    await waitFor(() => expect(audio).toHaveAttribute('src'))
    Object.defineProperty(audio, 'duration', { value: 30, configurable: true })
    fireEvent.loadedMetadata(audio)
    expect(audio).toHaveProperty('currentTime', 20)
    expect(audio).toHaveAttribute('src', 'https://storage.example/audio')
  })
})

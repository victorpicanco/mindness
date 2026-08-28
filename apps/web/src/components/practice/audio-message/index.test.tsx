import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { messages } from '@/i18n/messages'
import { ApiClientError } from '@/lib/api/client-error'

import { AudioMessage, type ResolveAudioSource } from './index'

function renderMessage(resolveSource?: ResolveAudioSource) {
  render(
    <NextIntlClientProvider locale="pt-BR" messages={messages}>
      <AudioMessage
        label="Sua mensagem"
        seed="7d5f46c9"
        {...(resolveSource === undefined ? {} : { resolveSource })}
      />
    </NextIntlClientProvider>,
  )
}

describe('AudioMessage', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('resolves the source only when playback is asked for, then plays it', async () => {
    const resolveSource = vi.fn(() => Promise.resolve('https://storage.example/signed-audio'))
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
    renderMessage(resolveSource)

    expect(resolveSource).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Reproduzir gravação' }))

    await waitFor(() => expect(play).toHaveBeenCalledOnce())
    expect(screen.getByLabelText('Gravação da sessão')).toHaveAttribute(
      'src',
      'https://storage.example/signed-audio',
    )
  })

  it('pauses the recording that is already running', async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
    const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined)
    renderMessage(() => Promise.resolve('https://storage.example/signed-audio'))

    fireEvent.click(screen.getByRole('button', { name: 'Reproduzir gravação' }))
    await waitFor(() => expect(play).toHaveBeenCalledOnce())
    fireEvent.play(screen.getByLabelText('Gravação da sessão'))

    fireEvent.click(await screen.findByRole('button', { name: 'Pausar gravação' }))

    expect(pause).toHaveBeenCalledOnce()
  })

  it('reports a source that cannot be played and drops the broken src', async () => {
    const resolveSource = vi.fn(() =>
      Promise.reject(
        new ApiClientError({
          code: 'sessions.AUDIO_PLAYBACK_UNAVAILABLE',
          issues: null,
          message: 'expired',
          requestId: 'request-id',
        }),
      ),
    )
    renderMessage(resolveSource)

    fireEvent.click(screen.getByRole('button', { name: 'Reproduzir gravação' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível reproduzir a gravação. Tente novamente.',
    )
    expect(screen.getByLabelText('Gravação da sessão')).not.toHaveAttribute('src')
  })

  it('disables the control when the recording is not available to play', () => {
    renderMessage()

    expect(screen.getByRole('button', { name: 'Reproduzir gravação' })).toBeDisabled()
  })
})

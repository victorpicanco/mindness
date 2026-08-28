import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AudioPlayer } from './audio-player'
import { messages } from '@/i18n/messages'

const SESSION_ID = '7d5f46c9-3cbd-4c6d-84aa-66b8148a91aa'

describe('AudioPlayer', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('requests the playback url only when the person interacts with the player', async () => {
    const requestPlaybackUrl = vi.fn(() =>
      Promise.resolve({
        expiresAt: '2026-08-24T12:15:00.000Z',
        signedUrl: 'https://storage.example/signed-audio',
      }),
    )
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()

    render(
      <NextIntlClientProvider locale="pt-BR" messages={messages}>
        <AudioPlayer requestPlaybackUrl={requestPlaybackUrl} sessionId={SESSION_ID} />
      </NextIntlClientProvider>,
    )

    expect(requestPlaybackUrl).not.toHaveBeenCalled()

    const player = screen.getByLabelText('Gravação da sessão')
    fireEvent.click(screen.getByRole('button', { name: 'Reproduzir gravação' }))

    await waitFor(() => expect(requestPlaybackUrl).toHaveBeenCalledOnce())
    expect(requestPlaybackUrl).toHaveBeenCalledWith(SESSION_ID)
    expect(player).toHaveAttribute('src', 'https://storage.example/signed-audio')
    expect(play).toHaveBeenCalledOnce()
  })
})

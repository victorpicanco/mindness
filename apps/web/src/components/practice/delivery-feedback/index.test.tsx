import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AnalysisPlaybackProvider } from '@/components/practice/analysis-playback'
import { AudioMessage } from '@/components/practice/audio-message'
import { messages } from '@/i18n/messages'
import { deliveryFeedbackSchema } from '@/lib/api/contracts/sessions/delivery-schema'
import { createDeliveryFeedback } from '@/lib/api/contracts/sessions/fixtures'

import { DeliveryFeedback } from './index'

const DELIVERY = deliveryFeedbackSchema.parse(createDeliveryFeedback())

function renderFeedback() {
  return render(
    <NextIntlClientProvider locale="pt-BR" messages={messages}>
      <AnalysisPlaybackProvider>
        <AudioMessage
          label="Gravação"
          resolveSource={() => Promise.resolve('https://storage.example/audio')}
          seed="session"
        />
        <DeliveryFeedback delivery={DELIVERY} />
      </AnalysisPlaybackProvider>
    </NextIntlClientProvider>,
  )
}

describe('DeliveryFeedback', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('pauses the recording from the excerpt button that started it', async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
    const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined)
    renderFeedback()

    fireEvent.click(screen.getByRole('button', { name: 'Ouvir trecho em 00:20' }))
    await waitFor(() => expect(play).toHaveBeenCalledOnce())
    fireEvent.play(screen.getByLabelText('Gravação da sessão'))

    const pauseButton = screen.getByRole('button', { name: 'Pausar trecho em 00:20' })
    expect(pauseButton).toHaveAttribute('data-excerpt-state', 'playing')

    fireEvent.click(pauseButton)
    expect(pause).toHaveBeenCalledOnce()
    fireEvent.pause(screen.getByLabelText('Gravação da sessão'))

    expect(screen.getByRole('button', { name: 'Ouvir trecho em 00:20' })).toHaveAttribute(
      'data-excerpt-state',
      'paused',
    )
  })

  it('marks only the excerpt being played', async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined)
    renderFeedback()

    fireEvent.click(screen.getByRole('button', { name: 'Ouvir trecho em 00:01' }))
    await waitFor(() => expect(play).toHaveBeenCalledOnce())
    fireEvent.play(screen.getByLabelText('Gravação da sessão'))

    expect(screen.getByRole('button', { name: 'Pausar trecho em 00:01' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ouvir trecho em 00:20' })).toBeInTheDocument()
  })

  it('keeps the excerpt buttons idle while the whole recording plays', async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
    renderFeedback()

    fireEvent.click(screen.getByRole('button', { name: 'Reproduzir gravação' }))
    await waitFor(() => expect(play).toHaveBeenCalledOnce())
    fireEvent.play(screen.getByLabelText('Gravação da sessão'))

    expect(screen.getByRole('button', { name: 'Ouvir trecho em 00:20' })).toHaveAttribute(
      'data-excerpt-state',
      'paused',
    )
  })
})

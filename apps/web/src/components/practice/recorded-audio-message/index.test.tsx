import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { useEffect, type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { messages } from '@/i18n/messages'
import {
  PracticeSessionProvider,
  usePracticeSessionStore,
} from '@/stores/practice-session/provider'

import { RecordedAudioMessage } from './index'

const SESSION_ID = '7d5f46c9-3cbd-4c6d-84aa-66b8148a91aa'
const OBJECT_URL = 'blob:https://mindness.local/recorded-audio'

function CaptureAudio({ children }: { readonly children: ReactNode }) {
  const captureAudio = usePracticeSessionStore((state) => state.captureAudio)

  useEffect(() => captureAudio(new Blob(['audio'])), [captureAudio])

  return children
}

function renderRecordedAudio(withCapture: boolean) {
  const message = (
    <NextIntlClientProvider locale="pt-BR" messages={messages}>
      <PracticeSessionProvider
        initialState={{
          serverTimeOffsetMs: 0,
          session: {
            configuration: {
              categorySlug: 'news',
              difficulty: 'balanced',
              searchWindowMinutes: 3,
            } as const,
            createdAt: '2026-08-27T12:00:00.000Z',
            expiresAt: '2026-08-27T12:15:00.000Z',
            recordingStartedAt: '2026-08-27T12:03:00.000Z',
            researchEndsAt: '2026-08-27T12:03:00.000Z',
            sessionId: SESSION_ID,
            themeTitle: 'Notícias do dia',
          },
          status: 'recording',
        }}
      >
        {withCapture ? (
          <CaptureAudio>
            <RecordedAudioMessage label="Sua mensagem" />
          </CaptureAudio>
        ) : (
          <RecordedAudioMessage label="Sua mensagem" />
        )}
      </PracticeSessionProvider>
    </NextIntlClientProvider>
  )

  return render(message)
}

describe('RecordedAudioMessage', () => {
  let createObjectURL = vi.fn(() => OBJECT_URL)
  let revokeObjectURL = vi.fn((url: string) => url)

  beforeEach(() => {
    createObjectURL = vi.fn(() => OBJECT_URL)
    revokeObjectURL = vi.fn((url: string) => url)
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL })
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('plays the recording that the session still retains in memory', async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
    renderRecordedAudio(true)

    fireEvent.click(screen.getByRole('button', { name: 'Reproduzir gravação' }))

    await waitFor(() => expect(play).toHaveBeenCalledOnce())
    expect(screen.getByLabelText('Gravação da sessão')).toHaveAttribute('src', OBJECT_URL)
  })

  it('releases the object url once the message leaves the screen', async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
    const { unmount } = renderRecordedAudio(true)

    fireEvent.click(screen.getByRole('button', { name: 'Reproduzir gravação' }))
    await waitFor(() => expect(play).toHaveBeenCalledOnce())

    unmount()

    expect(revokeObjectURL).toHaveBeenCalledWith(OBJECT_URL)
  })

  it('keeps the player disabled when the recording is no longer retained', () => {
    renderRecordedAudio(false)

    expect(screen.getByRole('button', { name: 'Reproduzir gravação' })).toBeDisabled()
    expect(createObjectURL).not.toHaveBeenCalled()
  })
})

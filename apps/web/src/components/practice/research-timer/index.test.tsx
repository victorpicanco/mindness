import { act, cleanup, render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { messages } from '@/i18n/messages'
import {
  PracticeSessionProvider,
  usePracticeSessionStore,
} from '@/stores/practice-session/provider'

import { ResearchTimerView } from '@/components/practice/research-timer'

const NOW = new Date('2026-08-24T12:00:00.000Z')

function PracticeSessionProbe() {
  const status = usePracticeSessionStore((state) => state.status)

  return <output aria-label="practice status">{status}</output>
}

function renderResearchTimer(
  researchEndsInSeconds: number,
  logAudioFailure: (cause: unknown) => void = () => undefined,
) {
  return render(
    <NextIntlClientProvider locale="pt-BR" messages={messages}>
      <PracticeSessionProvider
        initialState={{
          serverTimeOffsetMs: NOW.getTime() - Date.now(),
          session: {
            configuration: {
              categorySlug: 'news',
              difficulty: 'balanced',
              searchWindowMinutes: 3,
            } as const,
            createdAt: NOW.toISOString(),
            expiresAt: new Date(
              NOW.getTime() + (researchEndsInSeconds + 120) * 1_000,
            ).toISOString(),
            recordingStartedAt: null,
            researchEndsAt: new Date(NOW.getTime() + researchEndsInSeconds * 1_000).toISOString(),
            sessionId: '7d5f46c9-3cbd-4c6d-84aa-66b8148a91aa',
            themeTitle: 'Comunicação clara',
          },
          status: 'researching',
        }}
      >
        <ResearchTimerView logAudioFailure={logAudioFailure ?? (() => undefined)} />
        <PracticeSessionProbe />
      </PracticeSessionProvider>
    </NextIntlClientProvider>,
  )
}

async function advanceOneSecond() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1_000)
  })
}

describe('ResearchTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('counts the chosen research window and warns with ten seconds remaining', async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()

    renderResearchTimer(11)

    expect(screen.getByRole('heading', { name: 'Comunicação clara' })).toBeInTheDocument()
    expect(screen.getByRole('timer')).toHaveTextContent('00:11')

    await advanceOneSecond()

    expect(screen.getByRole('timer')).toHaveTextContent('00:10')
    expect(play).toHaveBeenCalledOnce()
  })

  it('keeps the visual countdown running when warning playback fails', async () => {
    const playbackFailure = new DOMException('Playback blocked', 'NotAllowedError')
    const failures: unknown[] = []

    vi.spyOn(HTMLMediaElement.prototype, 'play').mockRejectedValue(playbackFailure)
    renderResearchTimer(11, (cause) => failures.push(cause))

    await advanceOneSecond()
    await advanceOneSecond()

    expect(failures).toEqual([playbackFailure])
    expect(screen.getByRole('timer')).toHaveTextContent('00:09')
    expect(screen.getByLabelText('practice status')).toHaveTextContent('researching')
  })

  it('opens the recording window at zero instead of recording on its own', async () => {
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()

    renderResearchTimer(1)

    await advanceOneSecond()

    expect(screen.getByLabelText('practice status')).toHaveTextContent('awaiting-recording')
    expect(screen.getByRole('timer')).toHaveTextContent('00:00')
  })

  it('uses the stored server offset when the browser clock is behind', () => {
    vi.setSystemTime(new Date(NOW.getTime() - 5 * 60 * 1_000))

    renderResearchTimer(11)

    expect(screen.getByRole('timer')).toHaveTextContent('00:11')
  })
})

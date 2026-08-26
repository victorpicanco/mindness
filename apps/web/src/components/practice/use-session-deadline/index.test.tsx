import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  PracticeSessionProvider,
  usePracticeSessionStore,
} from '@/stores/practice-session/provider'

import { useSessionDeadline } from '@/components/practice/use-session-deadline'

const NOW = new Date('2026-08-24T12:00:00.000Z')

function DeadlineProbe({ onExpired }: { readonly onExpired: () => void }) {
  useSessionDeadline({ onExpired })
  const status = usePracticeSessionStore((state) => state.status)

  return <output>{status}</output>
}

function renderDeadline(
  status: 'awaiting-recording' | 'recording' | 'uploading',
  onExpired: () => void,
) {
  return render(
    <PracticeSessionProvider
      initialState={{
        serverTimeOffsetMs: NOW.getTime() - Date.now(),
        session: {
          createdAt: NOW.toISOString(),
          expiresAt: new Date(NOW.getTime() + 1_000).toISOString(),
          recordingStartedAt: status === 'awaiting-recording' ? null : NOW.toISOString(),
          researchEndsAt: NOW.toISOString(),
          sessionId: '7d5f46c9-3cbd-4c6d-84aa-66b8148a91aa',
          themeTitle: 'Communicating with clarity',
        },
        status,
      }}
    >
      <DeadlineProbe onExpired={onExpired} />
    </PracticeSessionProvider>,
  )
}

describe('useSessionDeadline', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it.each(['awaiting-recording', 'recording', 'uploading'] as const)(
    'expires a %s session when its deadline passes',
    async (status) => {
      const onExpired = vi.fn()
      renderDeadline(status, onExpired)

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1_000)
      })

      expect(screen.getByRole('status')).toHaveTextContent('expired')
      expect(onExpired).toHaveBeenCalledOnce()
    },
  )

  it('uses the stored server offset when the browser clock is behind', async () => {
    vi.setSystemTime(new Date(NOW.getTime() - 5 * 60 * 1_000))
    const onExpired = vi.fn()
    renderDeadline('recording', onExpired)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000)
    })

    expect(screen.getByRole('status')).toHaveTextContent('expired')
    expect(onExpired).toHaveBeenCalledOnce()
  })
})

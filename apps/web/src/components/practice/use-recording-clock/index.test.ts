import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { MAX_RECORDING_SECONDS, useRecordingClock } from '@/components/practice/use-recording-clock'

async function advance(milliseconds: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(milliseconds)
  })
}

describe('useRecordingClock', () => {
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('rests at zero while nothing is being recorded', () => {
    const { result } = renderHook(() =>
      useRecordingClock({ isActive: false, onLimitReached: vi.fn() }),
    )

    expect(result.current).toBe(0)
  })

  it('counts up one second at a time while recording', async () => {
    vi.useFakeTimers()
    const { result } = renderHook(() =>
      useRecordingClock({ isActive: true, onLimitReached: vi.fn() }),
    )

    await advance(1_000)
    expect(result.current).toBe(1)

    await advance(2_000)
    expect(result.current).toBe(3)
  })

  it('anchors elapsed time to the server recording timestamp', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-24T12:00:03.000Z'))
    const { result } = renderHook(() =>
      useRecordingClock({
        isActive: true,
        onLimitReached: vi.fn(),
        startedAt: '2026-08-24T12:00:00.000Z',
      }),
    )

    await advance(1_000)

    expect(result.current).toBe(4)
  })

  it('stops at the one minute limit and reports it a single time', async () => {
    vi.useFakeTimers()
    const onLimitReached = vi.fn()
    const { result } = renderHook(() => useRecordingClock({ isActive: true, onLimitReached }))

    await advance(MAX_RECORDING_SECONDS * 1_000)

    expect(result.current).toBe(MAX_RECORDING_SECONDS)
    expect(onLimitReached).toHaveBeenCalledOnce()

    await advance(5_000)

    expect(result.current).toBe(MAX_RECORDING_SECONDS)
    expect(onLimitReached).toHaveBeenCalledOnce()
  })

  it('stops before the domain audio duration ceiling', () => {
    expect(MAX_RECORDING_SECONDS).toBeLessThan(60)
  })

  it('goes back to zero once the recording stops', async () => {
    vi.useFakeTimers()
    const { rerender, result } = renderHook(
      ({ isActive }: { isActive: boolean }) =>
        useRecordingClock({ isActive, onLimitReached: vi.fn() }),
      { initialProps: { isActive: true } },
    )

    await advance(3_000)
    expect(result.current).toBe(3)

    rerender({ isActive: false })

    expect(result.current).toBe(0)
  })
})

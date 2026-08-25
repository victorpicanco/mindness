import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { BAR_INTERVAL_MS, useAudioLevels } from './use-audio-levels'

class FakeMicrophoneError extends Error {
  constructor() {
    super('The fake microphone is unavailable')
    this.name = 'FakeMicrophoneError'
  }
}

const IDLE_LEVEL = 0.2

function fakeSource(firstReads: readonly number[]) {
  const stop = vi.fn()
  let frame = 0

  return {
    source: () =>
      Promise.resolve({
        read: () => {
          const value = firstReads[frame] ?? IDLE_LEVEL

          frame += 1

          return value
        },
        stop,
      }),
    stop,
  }
}

async function advance(milliseconds: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(milliseconds)
  })
}

describe('useAudioLevels', () => {
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('starts empty while it is not capturing', () => {
    const { source } = fakeSource([])
    const { result } = renderHook(() => useAudioLevels({ historySize: 4, isActive: false, source }))

    expect(result.current.levels).toEqual([])
    expect(result.current.hasFailed).toBe(false)
  })

  it('appends one level per interval holding the loudest frame of that interval', async () => {
    vi.useFakeTimers()
    const { source } = fakeSource([0.1, 0.9])
    const { result } = renderHook(() => useAudioLevels({ historySize: 8, isActive: true, source }))

    await advance(BAR_INTERVAL_MS * 2)

    expect(result.current.levels.length).toBeGreaterThan(0)
    expect(result.current.levels[0]).toBe(0.9)
  })

  it('keeps only the newest levels the history can hold', async () => {
    vi.useFakeTimers()
    const { source } = fakeSource([])
    const { result } = renderHook(() => useAudioLevels({ historySize: 3, isActive: true, source }))

    await advance(BAR_INTERVAL_MS * 20)

    expect(result.current.levels).toEqual([IDLE_LEVEL, IDLE_LEVEL, IDLE_LEVEL])
  })

  it('releases the source and clears the levels when capturing stops', async () => {
    vi.useFakeTimers()
    const { source, stop } = fakeSource([])
    const { rerender, result } = renderHook(
      ({ isActive }: { isActive: boolean }) => useAudioLevels({ historySize: 4, isActive, source }),
      { initialProps: { isActive: true } },
    )

    await advance(BAR_INTERVAL_MS * 4)
    expect(result.current.levels.length).toBeGreaterThan(0)

    rerender({ isActive: false })

    expect(stop).toHaveBeenCalledOnce()
    expect(result.current.levels).toEqual([])
  })

  it('releases the source when the component unmounts', async () => {
    vi.useFakeTimers()
    const { source, stop } = fakeSource([])
    const { unmount } = renderHook(() => useAudioLevels({ historySize: 4, isActive: true, source }))

    await advance(BAR_INTERVAL_MS)
    unmount()

    expect(stop).toHaveBeenCalledOnce()
  })

  it('reports a failure when the source cannot be opened', async () => {
    const source = () => Promise.reject(new FakeMicrophoneError())
    const { result } = renderHook(() => useAudioLevels({ historySize: 4, isActive: true, source }))

    await waitFor(() => {
      expect(result.current.hasFailed).toBe(true)
    })
    expect(result.current.levels).toEqual([])
  })
})

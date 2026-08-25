import { act, cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  BAR_MAX_HEIGHT,
  BAR_MIN_HEIGHT,
  SLOT_PITCH,
  WaveformTrack,
  waveformBarHeight,
} from './waveform-track'

type ResizeCallback = (
  entries: readonly { readonly contentRect: { readonly width: number } }[],
) => void

function stubRailWidth() {
  const callbacks: ResizeCallback[] = []
  const disconnect = vi.fn()

  class FakeResizeObserver {
    constructor(callback: ResizeCallback) {
      callbacks.push(callback)
    }

    disconnect = disconnect
    observe = vi.fn()
    unobserve = vi.fn()
  }

  vi.stubGlobal('ResizeObserver', FakeResizeObserver)

  return {
    disconnect,
    resizeTo: (width: number) => {
      act(() => {
        for (const callback of callbacks) callback([{ contentRect: { width } }])
      })
    },
  }
}

function slotKinds(container: HTMLElement): (string | null)[] {
  return [...container.querySelectorAll('[data-waveform]')].map((slot) =>
    slot.getAttribute('data-waveform'),
  )
}

describe('WaveformTrack', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('fills the whole rail with dots while nothing was captured', () => {
    const { container } = render(<WaveformTrack levels={[]} slotCount={4} />)

    expect(slotKinds(container)).toEqual(['dot', 'dot', 'dot', 'dot'])
  })

  it('anchors the captured levels to the right end of the rail', () => {
    const { container } = render(<WaveformTrack levels={[0.2, 0.4]} slotCount={5} />)

    expect(slotKinds(container)).toEqual(['dot', 'dot', 'dot', 'bar', 'bar'])
  })

  it('drops the oldest levels once the rail is full', () => {
    const { container } = render(<WaveformTrack levels={[0.1, 0.2, 0.3, 0.4]} slotCount={2} />)

    expect(slotKinds(container)).toEqual(['bar', 'bar'])
  })

  it('hides the rail from assistive technology', () => {
    const { container } = render(<WaveformTrack levels={[]} slotCount={2} />)

    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true')
  })

  it('scales a bar against a fixed peak so the waveform does not dance', () => {
    expect(waveformBarHeight(0)).toBe(BAR_MIN_HEIGHT)
    expect(waveformBarHeight(1)).toBe(BAR_MAX_HEIGHT)
    expect(waveformBarHeight(0.5)).toBe(BAR_MIN_HEIGHT + (BAR_MAX_HEIGHT - BAR_MIN_HEIGHT) / 2)
  })

  it('clamps a level that goes past the fixed peak', () => {
    expect(waveformBarHeight(4)).toBe(BAR_MAX_HEIGHT)
    expect(waveformBarHeight(-1)).toBe(BAR_MIN_HEIGHT)
  })

  it('drops the slots a narrow rail cannot hold instead of clipping the newest ones', () => {
    const rail = stubRailWidth()
    const { container } = render(<WaveformTrack levels={[0.1, 0.2, 0.3]} slotCount={10} />)

    rail.resizeTo(SLOT_PITCH * 4)

    expect(slotKinds(container)).toEqual(['dot', 'bar', 'bar', 'bar'])
  })

  it('keeps the whole rail when the width can hold every slot', () => {
    const rail = stubRailWidth()
    const { container } = render(<WaveformTrack levels={[]} slotCount={3} />)

    rail.resizeTo(SLOT_PITCH * 40)

    expect(slotKinds(container)).toEqual(['dot', 'dot', 'dot'])
  })

  it('stops observing the rail when it leaves the screen', () => {
    const rail = stubRailWidth()
    const { unmount } = render(<WaveformTrack levels={[]} slotCount={3} />)

    unmount()

    expect(rail.disconnect).toHaveBeenCalledOnce()
  })
})

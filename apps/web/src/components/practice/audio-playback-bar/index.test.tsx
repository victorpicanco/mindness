import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AudioPlaybackBar, playbackLevels } from './index'

function renderBar(overrides: Partial<Parameters<typeof AudioPlaybackBar>[0]> = {}) {
  render(
    <AudioPlaybackBar
      groupLabel="Áudio enviado"
      isPlaying={false}
      levels={playbackLevels('seed', 10)}
      onToggle={vi.fn()}
      pauseLabel="Pausar gravação"
      playLabel="Reproduzir gravação"
      progress={0}
      timeLabel="00:00"
      {...overrides}
    />,
  )
}

describe('AudioPlaybackBar', () => {
  afterEach(cleanup)

  it('offers play while the recording is paused and pause while it runs', () => {
    renderBar()
    expect(screen.getByRole('button', { name: 'Reproduzir gravação' })).toBeInTheDocument()

    cleanup()
    renderBar({ isPlaying: true })
    expect(screen.getByRole('button', { name: 'Pausar gravação' })).toBeInTheDocument()
  })

  it('fills the waveform up to the played position', () => {
    renderBar({ progress: 0.5 })

    const bars = screen
      .getByRole('group', { name: 'Áudio enviado' })
      .querySelectorAll('[data-waveform="bar"]')
    const played = [...bars].filter((bar) => bar.getAttribute('data-played') === 'true')

    expect(bars).toHaveLength(10)
    expect(played).toHaveLength(5)
  })

  it('disables the control when there is nothing to play', () => {
    renderBar({ isDisabled: true })

    expect(screen.getByRole('button', { name: 'Reproduzir gravação' })).toBeDisabled()
  })
})

describe('playbackLevels', () => {
  it('derives a stable waveform per seed', () => {
    expect(playbackLevels('session-a', 8)).toEqual(playbackLevels('session-a', 8))
    expect(playbackLevels('session-a', 8)).not.toEqual(playbackLevels('session-b', 8))
  })

  it('keeps every bar within the drawable range', () => {
    for (const level of playbackLevels('session-a', 64)) {
      expect(level).toBeGreaterThan(0)
      expect(level).toBeLessThanOrEqual(1)
    }
  })
})

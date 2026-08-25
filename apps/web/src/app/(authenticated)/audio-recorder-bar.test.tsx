import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AudioRecorderBar } from './audio-recorder-bar'

const LABELS = {
  groupLabel: 'Gravador de áudio',
  recordLabel: 'Iniciar gravação',
  stopLabel: 'Parar gravação',
} as const

interface RenderOverrides {
  readonly elapsedLabel?: string
  readonly isDisabled?: boolean
  readonly isRecording?: boolean
  readonly levels?: readonly number[]
}

function renderBar(overrides: RenderOverrides = {}) {
  const onToggleRecording = vi.fn()
  const view = render(
    <AudioRecorderBar
      {...LABELS}
      elapsedLabel={overrides.elapsedLabel ?? '00:00'}
      isDisabled={overrides.isDisabled ?? false}
      isRecording={overrides.isRecording ?? false}
      levels={overrides.levels ?? []}
      onToggleRecording={onToggleRecording}
    />,
  )

  return { ...view, onToggleRecording }
}

describe('AudioRecorderBar', () => {
  afterEach(cleanup)

  it('offers the microphone as the only action while idle', () => {
    renderBar()

    const record = screen.getByRole('button', { name: LABELS.recordLabel })

    expect(record.querySelector('.hgi-audio-wave-01')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: LABELS.stopLabel })).not.toBeInTheDocument()
    expect(screen.getAllByRole('button')).toHaveLength(1)
  })

  it('names the recorder as a single group for assistive technology', () => {
    renderBar()

    const recorder = screen.getByRole('group', { name: LABELS.groupLabel })

    expect(recorder).toHaveAttribute('data-recording-state', 'idle')
  })

  it('turns the microphone into a stop action while recording', () => {
    renderBar({ isRecording: true })

    const stop = screen.getByRole('button', { name: LABELS.stopLabel })

    expect(stop.querySelector('.hgi-stop')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: LABELS.recordLabel })).not.toBeInTheDocument()
    expect(screen.getByRole('group', { name: LABELS.groupLabel })).toHaveAttribute(
      'data-recording-state',
      'recording',
    )
  })

  it('reports the toggle to the caller', () => {
    const { onToggleRecording } = renderBar()

    fireEvent.click(screen.getByRole('button', { name: LABELS.recordLabel }))

    expect(onToggleRecording).toHaveBeenCalledOnce()
  })

  it('refuses the toggle while the recorder is disabled', () => {
    const { onToggleRecording } = renderBar({ isDisabled: true })

    const record = screen.getByRole('button', { name: LABELS.recordLabel })

    expect(record).toBeDisabled()

    fireEvent.click(record)

    expect(onToggleRecording).not.toHaveBeenCalled()
  })

  it('shows how long the recording has been running', () => {
    renderBar({ elapsedLabel: '00:12', isRecording: true })

    expect(screen.getByRole('timer')).toHaveTextContent('00:12')
  })

  it('leaves the timer role to the screen while nothing is being recorded', () => {
    renderBar()

    expect(screen.queryByRole('timer')).not.toBeInTheDocument()
    expect(screen.getByText('00:00')).toBeInTheDocument()
  })

  it('draws one bar per captured level', () => {
    const { container } = renderBar({ isRecording: true, levels: [0.2, 0.5, 0.8] })

    expect(container.querySelectorAll('[data-waveform="bar"]')).toHaveLength(3)
  })
})

import { act, cleanup, render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { messages } from '@/i18n/messages'

import { PROCESSING_STEP_INTERVAL_MS, ProcessingSteps } from './index'

function renderSteps() {
  render(
    <NextIntlClientProvider locale="pt-BR" messages={messages}>
      <ProcessingSteps />
    </NextIntlClientProvider>,
  )
}

describe('ProcessingSteps', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('opens on the upload step while announcing a single stable status', () => {
    renderSteps()

    expect(screen.getByRole('status')).toHaveTextContent('Estamos analisando sua apresentação…')
    expect(screen.getByText('Enviando seu áudio…')).toBeInTheDocument()
  })

  it('replaces the visible step as the wait goes on, one line at a time', async () => {
    renderSteps()

    await act(() => vi.advanceTimersByTimeAsync(PROCESSING_STEP_INTERVAL_MS))

    expect(screen.getByText('Transcrevendo sua fala…')).toBeInTheDocument()
    expect(screen.queryByText('Enviando seu áudio…')).not.toBeInTheDocument()

    await act(() => vi.advanceTimersByTimeAsync(PROCESSING_STEP_INTERVAL_MS))

    expect(screen.getByText('Medindo seu ritmo e suas pausas…')).toBeInTheDocument()
  })

  it('holds the closing step instead of looping back to the upload', async () => {
    renderSteps()

    for (let tick = 0; tick < 40; tick += 1) {
      await act(() => vi.advanceTimersByTimeAsync(PROCESSING_STEP_INTERVAL_MS))
    }

    expect(screen.getByText('Montando sua análise…')).toBeInTheDocument()
    expect(screen.queryByText('Enviando seu áudio…')).not.toBeInTheDocument()
  })

  it('holds the opening step while the upload is still running', async () => {
    render(
      <NextIntlClientProvider locale="pt-BR" messages={messages}>
        <ProcessingSteps paused />
      </NextIntlClientProvider>,
    )

    await act(() => vi.advanceTimersByTimeAsync(PROCESSING_STEP_INTERVAL_MS * 3))

    expect(screen.getByText('Enviando seu áudio…')).toBeInTheDocument()
  })

  it('keeps the rotating line out of the announcement so it is read only once', () => {
    renderSteps()

    expect(screen.getByText('Enviando seu áudio…').closest('[aria-hidden="true"]')).not.toBeNull()
  })
})

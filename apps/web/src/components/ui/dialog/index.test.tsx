import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Dialog } from './index'

const noop = () => undefined

function DialogWithLateControl() {
  const [hasLateControl, setHasLateControl] = useState(false)

  return (
    <Dialog description="Choose what happens next" onClose={noop} open title="Confirm">
      <button onClick={() => setHasLateControl(true)} type="button">
        Reveal
      </button>
      {hasLateControl ? <button type="button">Proceed</button> : null}
    </Dialog>
  )
}

describe('Dialog', () => {
  beforeEach(() => {
    HTMLDialogElement.prototype.showModal = function showModal() {
      this.setAttribute('open', '')
    }
    HTMLDialogElement.prototype.close = function close() {
      this.removeAttribute('open')
    }
  })

  afterEach(cleanup)

  it('names itself from its title and description', () => {
    render(
      <Dialog description="Choose what happens next" onClose={() => undefined} open title="Confirm">
        <button type="button">Continue</button>
      </Dialog>,
    )

    expect(screen.getByRole('dialog', { name: 'Confirm' })).toHaveAccessibleDescription(
      'Choose what happens next',
    )
    expect(screen.getByRole('dialog')).toBeInstanceOf(HTMLDialogElement)
  })

  it('closes on Escape', () => {
    const onClose = vi.fn()

    render(
      <Dialog description="Choose what happens next" onClose={onClose} open title="Confirm">
        <button type="button">Continue</button>
      </Dialog>,
    )
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }))

    expect(onClose).toHaveBeenCalledOnce()
  })

  it('keeps controls revealed after opening inside the native dialog', () => {
    render(<DialogWithLateControl />)

    fireEvent.click(screen.getByRole('button', { name: 'Reveal' }))

    expect(screen.getByRole('dialog')).toContainElement(
      screen.getByRole('button', { name: 'Proceed' }),
    )
  })
})

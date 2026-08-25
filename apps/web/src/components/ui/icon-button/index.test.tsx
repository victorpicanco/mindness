import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { IconButton } from './index'

describe('IconButton', () => {
  afterEach(cleanup)

  it('names the button by its label and renders the icon decoratively', () => {
    render(<IconButton icon="sidebar-left" label="Recolher barra lateral" />)

    const button = screen.getByRole('button', { name: 'Recolher barra lateral' })

    expect(button).toHaveAttribute('type', 'button')
    expect(button.querySelector('[data-icon="sidebar-left"]')).toHaveAttribute(
      'aria-hidden',
      'true',
    )
  })

  it('forwards button attributes, the click handler and the ref', () => {
    const onClick = vi.fn()
    const ref = createRef<HTMLButtonElement>()

    render(
      <IconButton
        aria-controls="authenticated-sidebar"
        aria-expanded
        icon="menu-01"
        label="Abrir navegação"
        onClick={onClick}
        ref={ref}
      />,
    )

    const button = screen.getByRole('button', { name: 'Abrir navegação' })
    fireEvent.click(button)

    expect(button).toHaveAttribute('aria-controls', 'authenticated-sidebar')
    expect(button).toHaveAttribute('aria-expanded', 'true')
    expect(onClick).toHaveBeenCalledOnce()
    expect(ref.current).toBe(button)
  })

  it('appends the given class name to the shared icon button styles', () => {
    render(<IconButton className="text-error" icon="cancel-01" label="Fechar navegação" />)

    expect(screen.getByRole('button', { name: 'Fechar navegação' })).toHaveClass(
      'grid',
      'size-10',
      'cursor-pointer',
      'text-error',
    )
  })

  it('stays a ghost icon button of the default size when no variant is given', () => {
    render(<IconButton icon="menu-01" label="Abrir navegação" />)

    expect(screen.getByRole('button', { name: 'Abrir navegação' })).toHaveClass(
      'size-10',
      'text-text-muted',
    )
  })

  it('renders a solid icon button in the requested size', () => {
    render(<IconButton icon="mic-01" label="Iniciar gravação" size="lg" variant="solid" />)

    expect(screen.getByRole('button', { name: 'Iniciar gravação' })).toHaveClass(
      'size-12',
      'rounded-full',
      'bg-text',
      'text-surface',
    )
  })

  it('marks a disabled icon button as not clickable', () => {
    render(<IconButton disabled icon="mic-01" label="Iniciar gravação" />)

    const button = screen.getByRole('button', { name: 'Iniciar gravação' })

    expect(button).toBeDisabled()
    expect(button).toHaveClass('disabled:cursor-not-allowed')
  })
})

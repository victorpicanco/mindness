import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { Menu } from './index'

function renderMenu(onSelect = vi.fn(), isDestructive = false) {
  render(
    <Menu
      actions={[{ isDestructive, label: 'Excluir', onSelect }]}
      triggerIcon="more-vertical"
      triggerLabel="Ações da sessão"
    />,
  )

  return { onSelect, trigger: screen.getByRole('button', { name: 'Ações da sessão' }) }
}

describe('Menu', () => {
  afterEach(cleanup)

  it('keeps its actions out of the document until the trigger is pressed', () => {
    const { trigger } = renderMenu()

    expect(trigger).toHaveAttribute('aria-haspopup', 'menu')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()

    fireEvent.click(trigger)

    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(
      within(screen.getByRole('menu')).getByRole('menuitem', { name: 'Excluir' }),
    ).toHaveFocus()
  })

  it('runs the chosen action once and closes', () => {
    const { onSelect, trigger } = renderMenu()

    fireEvent.click(trigger)
    fireEvent.click(screen.getByRole('menuitem', { name: 'Excluir' }))

    expect(onSelect).toHaveBeenCalledOnce()
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('closes on Escape and returns the focus to the trigger', () => {
    const { onSelect, trigger } = renderMenu()

    fireEvent.click(trigger)
    fireEvent.keyDown(window, { key: 'Escape' })

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('closes when a pointer lands outside it', () => {
    const { onSelect } = renderMenu()

    fireEvent.click(screen.getByRole('button', { name: 'Ações da sessão' }))
    fireEvent.pointerDown(document.body)

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('escapes the clipping of the list it is anchored to', () => {
    const { trigger } = renderMenu()

    fireEvent.click(trigger)

    const menu = screen.getByRole('menu')

    expect(menu.parentElement).toBe(document.body)
    expect(menu).toHaveClass('fixed', 'z-50')
    expect(menu).toHaveAccessibleName('Ações da sessão')
  })

  it('marks a destructive action so it reads as one', () => {
    renderMenu(vi.fn(), true)

    fireEvent.click(screen.getByRole('button', { name: 'Ações da sessão' }))

    expect(screen.getByRole('menuitem', { name: 'Excluir' })).toHaveClass('text-error')
  })
})

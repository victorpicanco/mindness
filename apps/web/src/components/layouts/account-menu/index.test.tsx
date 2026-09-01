import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AccountMenu } from './index'

const helpItems = ['Central de ajuda', 'Novidades', 'Atalhos do teclado']

function renderAccountMenu(signOut: () => void = () => undefined) {
  return render(
    <AccountMenu
      helpItems={helpItems}
      helpLabel="Ajuda"
      isExpanded
      name="Mindness"
      plan="Plano gratuito"
      popupLabel="Conta"
      settingsLabel="Configurações"
      signOut={signOut}
      signOutLabel="Sair"
    />,
  )
}

describe('AccountMenu', () => {
  afterEach(cleanup)

  it('presents the account identity in a compact sidebar footer control', () => {
    renderAccountMenu()

    const trigger = screen.getByRole('button', { name: 'Conta' })

    expect(trigger).toHaveTextContent('Mindness')
    expect(trigger).toHaveTextContent('Plano gratuito')
    expect(trigger).toHaveTextContent('M')
    expect(trigger).toHaveClass('h-13', 'rounded-xl', 'hover:bg-input')
    expect(trigger).not.toHaveClass('bg-input')
  })

  it('opens an account popup with settings, help, and sign-out actions', () => {
    renderAccountMenu()

    fireEvent.click(screen.getByRole('button', { name: 'Conta' }))

    const popup = screen.getByRole('dialog', { name: 'Conta' })

    expect(within(popup).getByRole('button', { name: 'Configurações' })).toBeInTheDocument()
    expect(within(popup).getByRole('button', { name: 'Ajuda' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
    expect(within(popup).getByRole('button', { name: 'Sair' })).toHaveAttribute('type', 'submit')
  })

  it('reveals the secondary help menu on hover or keyboard focus', () => {
    renderAccountMenu()

    fireEvent.click(screen.getByRole('button', { name: 'Conta' }))

    const popup = screen.getByRole('dialog', { name: 'Conta' })
    const help = within(popup).getByRole('button', { name: 'Ajuda' })

    fireEvent.mouseEnter(help)

    const helpPanel = screen.getByText('Central de ajuda').parentElement

    expect(helpPanel).not.toBeNull()
    expect(helpPanel).toHaveClass('pointer-events-auto', 'opacity-100')
  })

  it('submits the sign-out action from the account popup', () => {
    const signOut = vi.fn()
    renderAccountMenu(signOut)

    fireEvent.click(screen.getByRole('button', { name: 'Conta' }))
    fireEvent.click(screen.getByRole('button', { name: 'Sair' }))

    expect(signOut).toHaveBeenCalledOnce()
  })

  it('keeps only the avatar visible when the sidebar is collapsed', () => {
    render(
      <AccountMenu
        helpItems={helpItems}
        helpLabel="Ajuda"
        isExpanded={false}
        name="Mindness"
        plan="Plano gratuito"
        popupLabel="Conta"
        settingsLabel="Configurações"
        signOut={() => undefined}
        signOutLabel="Sair"
      />,
    )

    const trigger = screen.getByRole('button', { name: 'Conta' })

    expect(trigger).toHaveTextContent('M')
    expect(trigger).not.toHaveTextContent('Mindness')
    expect(trigger).not.toHaveTextContent('Plano gratuito')
  })
})

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AccountMenu } from './index'

function renderAccountMenu(
  signOut: () => void = () => undefined,
  onOpenSettings: () => void = () => undefined,
) {
  return render(
    <AccountMenu
      isExpanded
      name="Mindness"
      onOpenSettings={onOpenSettings}
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

  it('opens an account popup with settings and sign-out actions only', () => {
    renderAccountMenu()

    fireEvent.click(screen.getByRole('button', { name: 'Conta' }))

    const popup = screen.getByRole('dialog', { name: 'Conta' })

    expect(within(popup).getByRole('button', { name: 'Configurações' })).toBeInTheDocument()
    expect(within(popup).queryByRole('button', { name: 'Ajuda' })).not.toBeInTheDocument()
    expect(within(popup).getByRole('button', { name: 'Sair' })).toHaveAttribute('type', 'submit')
  })

  it('submits the sign-out action from the account popup', () => {
    const signOut = vi.fn()
    renderAccountMenu(signOut)

    fireEvent.click(screen.getByRole('button', { name: 'Conta' }))
    fireEvent.click(screen.getByRole('button', { name: 'Sair' }))

    expect(signOut).toHaveBeenCalledOnce()
  })

  it('opens settings and dismisses the account popup', () => {
    const onOpenSettings = vi.fn()
    renderAccountMenu(() => undefined, onOpenSettings)

    fireEvent.click(screen.getByRole('button', { name: 'Conta' }))
    fireEvent.click(screen.getByRole('button', { name: 'Configurações' }))

    expect(onOpenSettings).toHaveBeenCalledOnce()
    expect(screen.queryByRole('dialog', { name: 'Conta' })).not.toBeInTheDocument()
  })

  it('keeps only the avatar visible when the sidebar is collapsed', () => {
    render(
      <AccountMenu
        isExpanded={false}
        name="Mindness"
        onOpenSettings={() => undefined}
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

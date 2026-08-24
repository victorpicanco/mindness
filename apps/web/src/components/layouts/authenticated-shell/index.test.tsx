import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it } from 'vitest'

import { AuthenticatedShell } from './index'
import { messages } from '@/i18n/messages'

function renderShell(children: ReactNode, isInitiallyExpanded = true) {
  return render(
    <NextIntlClientProvider locale="pt-BR" messages={messages}>
      <AuthenticatedShell
        initialIsExpanded={isInitiallyExpanded}
        preferenceCookieName="mindness-sidebar-expanded"
      >
        {children}
      </AuthenticatedShell>
    </NextIntlClientProvider>,
  )
}

describe('AuthenticatedShell', () => {
  afterEach(cleanup)

  it('renders the application content beside an expanded sidebar', () => {
    renderShell(<h1>Dashboard</h1>)

    expect(screen.getByRole('main')).toHaveTextContent('Dashboard')
    expect(screen.getByLabelText('Recolher barra lateral')).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('complementary')).toHaveClass('w-64')
  })

  it('renders the persisted collapsed preference on the initial render', () => {
    renderShell(<p>Content</p>, false)

    expect(screen.getByRole('complementary')).toHaveClass('w-16')
    expect(screen.getByLabelText('Expandir barra lateral')).toHaveAttribute(
      'aria-expanded',
      'false',
    )
  })

  it('collapses from its control and expands from the sidebar background', () => {
    renderShell(<p>Content</p>)

    fireEvent.click(screen.getByLabelText('Recolher barra lateral'))

    const sidebar = screen.getByRole('complementary')
    const logo = within(sidebar).getByLabelText('Página inicial do Mindness')
    const sidebarBackground = within(sidebar).getByLabelText('Expandir barra lateral')

    expect(logo).toBeVisible()
    expect(logo).not.toHaveClass('group-hover:opacity-0')
    expect(sidebarBackground).toHaveClass('absolute', 'inset-0', 'cursor-col-resize')
    expect(sidebar).toHaveClass('w-16', 'cursor-col-resize')
    expect(document.cookie).toContain('mindness-sidebar-expanded=false')

    fireEvent.click(sidebarBackground)

    expect(screen.getByLabelText('Recolher barra lateral')).toHaveAttribute('aria-expanded', 'true')
    expect(document.cookie).toContain('mindness-sidebar-expanded=true')
  })

  it('renders the header above the page content, visible only on mobile', () => {
    renderShell(<p>Content</p>)

    const header = screen.getByRole('banner')
    const main = screen.getByRole('main')

    expect(header).toHaveClass('md:hidden')
    expect(header.compareDocumentPosition(main) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(within(header).getByLabelText('Abrir navegação')).toBeInTheDocument()
  })

  it('opens the mobile sidebar from its toggle and closes it from the backdrop', () => {
    renderShell(<p>Content</p>)

    const mobileToggle = within(screen.getByRole('banner')).getByLabelText('Abrir navegação')
    const mobileSidebar = screen.getByRole('dialog', {
      hidden: true,
      name: 'Navegação do aplicativo',
    })
    const backdrop = screen
      .getAllByLabelText('Fechar navegação')
      .find((element) => element.classList.contains('fixed'))

    expect(mobileToggle).toHaveAttribute('aria-controls', 'mobile-authenticated-sidebar')
    expect(mobileToggle).toHaveAttribute('aria-expanded', 'false')
    expect(mobileSidebar).toHaveClass(
      '-translate-x-full',
      'transition-transform',
      'duration-200',
      'ease-out',
      'motion-reduce:transition-none',
    )
    expect(backdrop).toBeDefined()

    if (backdrop === undefined) return

    expect(backdrop).toHaveClass('pointer-events-none', 'opacity-0', 'transition-opacity')

    fireEvent.click(mobileToggle)

    expect(mobileToggle).toHaveAttribute('aria-expanded', 'true')
    expect(mobileSidebar).toHaveAttribute('aria-modal', 'true')
    expect(mobileSidebar).toHaveClass('translate-x-0')
    expect(backdrop).toHaveClass('pointer-events-auto', 'opacity-100')

    fireEvent.click(backdrop)

    expect(mobileToggle).toHaveAttribute('aria-expanded', 'false')
    expect(mobileSidebar).toHaveClass('-translate-x-full')
    expect(backdrop).toHaveClass('pointer-events-none', 'opacity-0')
  })
})

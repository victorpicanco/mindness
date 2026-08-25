import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { PathnameContext } from 'next/dist/shared/lib/hooks-client-context.shared-runtime'
import { NextIntlClientProvider } from 'next-intl'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { SidebarNavigationItem } from '@/components/ui/sidebar'
import { messages } from '@/i18n/messages'

import { AuthenticatedShell } from './index'

function renderShell(
  children: ReactNode,
  isInitiallyExpanded = true,
  pathname = '/',
  header: ReactNode = <span>Header content</span>,
  sessionItems: readonly SidebarNavigationItem[] = [
    {
      href: '/7d5f46c9-3cbd-4c6d-84aa-66b8148a91aa',
      icon: 'clock-01',
      label: 'Foco · 24/08 09:00',
    },
  ],
  signOut: () => void = () => undefined,
) {
  return render(
    <PathnameContext.Provider value={pathname}>
      <NextIntlClientProvider locale="pt-BR" messages={messages}>
        <AuthenticatedShell
          initialIsExpanded={isInitiallyExpanded}
          preferenceCookieName="mindness-sidebar-expanded"
          sessionItems={sessionItems}
          signOut={signOut}
          {...(header === undefined ? {} : { header })}
        >
          {children}
        </AuthenticatedShell>
      </NextIntlClientProvider>
    </PathnameContext.Provider>,
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

  it('renders the configured navigation items in the sidebar', () => {
    renderShell(<p>Content</p>)

    const sidebar = screen.getByRole('complementary')
    const newSessionLink = within(sidebar).getByRole('link', { name: 'Nova sessão' })
    const progressLink = within(sidebar).getByRole('link', { name: 'Seu progresso' })

    expect(newSessionLink).toHaveAttribute('href', '/')
    expect(newSessionLink.querySelector('[data-icon="pencil-edit-02"]')).toBeInTheDocument()
    expect(progressLink).toHaveAttribute('href', '/history')
    expect(progressLink.querySelector('[data-icon="chart-increase"]')).toBeInTheDocument()
  })

  it('renders the server-synchronized session aggregate in the sidebar', () => {
    renderShell(<p>Content</p>)

    const sidebar = screen.getByRole('complementary')
    const sessionLink = within(sidebar).getByRole('link', { name: 'Foco · 24/08 09:00' })

    expect(within(sidebar).getByRole('navigation', { name: 'Sessões' })).toBeInTheDocument()
    expect(sessionLink).toHaveAttribute('href', '/7d5f46c9-3cbd-4c6d-84aa-66b8148a91aa')
  })

  it('renders a submit control for signing out in desktop and mobile sidebars', () => {
    renderShell(<p>Content</p>)

    const railSidebar = screen.getByRole('complementary')
    const railSignOut = within(railSidebar).getByRole('button', { name: 'Sair' })

    expect(railSignOut).toHaveAttribute('type', 'submit')
    expect(railSignOut.closest('form')).not.toBeNull()

    fireEvent.click(within(screen.getByRole('banner')).getByLabelText('Abrir navegação'))

    const mobileSidebar = screen.getByRole('dialog', { name: 'Navegação do aplicativo' })
    const mobileSignOut = within(mobileSidebar).getByRole('button', { name: 'Sair' })

    expect(mobileSignOut).toHaveAttribute('type', 'submit')
    expect(mobileSignOut.closest('form')).not.toBeNull()
  })

  it('highlights the navigation item matching the current route', () => {
    renderShell(<p>Content</p>, true, '/history')

    const sidebar = screen.getByRole('complementary')

    expect(within(sidebar).getByRole('link', { name: 'Seu progresso' })).toHaveClass('bg-input')
    expect(within(sidebar).getByRole('link', { name: 'Nova sessão' })).not.toHaveClass('bg-input')
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
    expect(
      within(sidebar)
        .getByRole('link', { name: 'Nova sessão' })
        .querySelector('[data-sidebar-icon]'),
    ).toHaveClass('grid', 'size-9', 'place-items-center')
    expect(
      within(sidebar)
        .getByRole('link', { name: 'Seu progresso' })
        .querySelector('[data-sidebar-icon]'),
    ).toHaveClass('grid', 'size-9', 'place-items-center')
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

    expect(header).not.toHaveClass('md:hidden')
    expect(header.compareDocumentPosition(main) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(within(header).getByLabelText('Abrir navegação')).toBeInTheDocument()
  })

  it('places the given header content beside the mobile navigation trigger', () => {
    renderShell(<p>Content</p>, true, '/', <span>4/4 sessões restantes</span>)

    const header = screen.getByRole('banner')

    expect(within(header).getByText('4/4 sessões restantes')).toBeInTheDocument()
    expect(within(header).getByLabelText('Abrir navegação')).toBeInTheDocument()
  })

  it('renders only the mobile navigation trigger when no header content is provided', () => {
    render(
      <PathnameContext.Provider value="/">
        <NextIntlClientProvider locale="pt-BR" messages={messages}>
          <AuthenticatedShell
            initialIsExpanded
            preferenceCookieName="mindness-sidebar-expanded"
            signOut={() => undefined}
          >
            <p>Content</p>
          </AuthenticatedShell>
        </NextIntlClientProvider>
      </PathnameContext.Provider>,
    )

    const header = screen.getByRole('banner')

    expect(within(header).getByLabelText('Abrir navegação')).toBeInTheDocument()
    expect(header.querySelector('.ml-auto')).not.toBeInTheDocument()
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

  it('submits the sign-out control to the action it was given', () => {
    const signOut = vi.fn()

    renderShell(<p>Content</p>, true, '/', undefined, [], signOut)

    // The drawer copy of the control is inert while the mobile sidebar is closed,
    // so only the rail copy is exposed to the accessibility tree.
    const signOutControls = screen.getAllByRole('button', { name: 'Sair' })

    expect(signOutControls).toHaveLength(1)
    for (const control of signOutControls) fireEvent.click(control)

    expect(signOut).toHaveBeenCalledOnce()
  })
})

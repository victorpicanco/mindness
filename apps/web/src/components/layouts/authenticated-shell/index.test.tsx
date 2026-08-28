import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime'
import { PathnameContext } from 'next/dist/shared/lib/hooks-client-context.shared-runtime'
import { NextIntlClientProvider } from 'next-intl'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { messages } from '@/i18n/messages'
import type { SessionDayGroup } from '@/lib/sessions/session-day-groups'

import { AuthenticatedShellView } from './index'

function renderShell(
  children: ReactNode,
  isInitiallyExpanded = true,
  pathname = '/',
  header: ReactNode = <span>Header content</span>,
  sessionGroups: readonly SessionDayGroup[] = [
    {
      heading: { kind: 'today' },
      localDate: '2026-08-25',
      items: [
        {
          href: '/sessions/7d5f46c9-3cbd-4c6d-84aa-66b8148a91aa',
          sessionId: '7d5f46c9-3cbd-4c6d-84aa-66b8148a91aa',
          title: 'Notícias do dia',
        },
      ],
    },
    {
      heading: { kind: 'date', value: '01/08/2026' },
      localDate: '2026-08-01',
      items: [
        {
          href: '/sessions/3c1c9f0e-2f3a-4a1e-9a44-2a0f8f5f2f11',
          sessionId: '3c1c9f0e-2f3a-4a1e-9a44-2a0f8f5f2f11',
          title: null,
        },
      ],
    },
  ],
  signOut: () => void = () => undefined,
  activeSessionId?: string,
  shouldConfirmSessionNavigation = false,
  abandonSession: (sessionId: string) => Promise<void> = () => Promise.resolve(),
) {
  const router = {
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
    push: vi.fn(),
    refresh: vi.fn(),
    replace: vi.fn(),
  }

  render(
    <AppRouterContext.Provider value={router}>
      <PathnameContext.Provider value={pathname}>
        <NextIntlClientProvider locale="pt-BR" messages={messages}>
          <AuthenticatedShellView
            abandonSession={abandonSession}
            {...(activeSessionId === undefined ? {} : { activeSessionId })}
            initialIsExpanded={isInitiallyExpanded}
            preferenceCookieName="mindness-sidebar-expanded"
            sessionGroups={sessionGroups}
            shouldConfirmSessionNavigation={shouldConfirmSessionNavigation}
            signOut={signOut}
            {...(header === undefined ? {} : { header })}
          >
            {children}
          </AuthenticatedShellView>
        </NextIntlClientProvider>
      </PathnameContext.Provider>
    </AppRouterContext.Provider>,
  )

  return router
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

  it('navigates to a new session when no session is active', () => {
    renderShell(<p>Content</p>)

    expect(
      within(screen.getByRole('complementary')).getByRole('link', { name: 'Nova sessão' }),
    ).toHaveAttribute('href', '/')
  })

  it('asks for confirmation before leaving an active session', () => {
    renderShell(<p>Content</p>, true, '/', undefined, [], () => undefined, 'active-session')

    fireEvent.click(
      within(screen.getByRole('complementary')).getByRole('link', { name: 'Nova sessão' }),
    )

    expect(
      screen.getByRole('dialog', { name: 'Você tem uma sessão em andamento' }),
    ).toBeInTheDocument()
  })

  it('returns to the active session from the confirmation dialog', () => {
    const router = renderShell(
      <p>Content</p>,
      true,
      '/',
      undefined,
      [],
      () => undefined,
      '7d5f46c9-3cbd-4c6d-84aa-66b8148a91aa',
    )

    fireEvent.click(
      within(screen.getByRole('complementary')).getByRole('link', { name: 'Nova sessão' }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Voltar para a sessão' }))

    expect(router.push).toHaveBeenCalledWith('/sessions/7d5f46c9-3cbd-4c6d-84aa-66b8148a91aa')
  })

  it('abandons the active session before navigating to a new one', async () => {
    const abandonSession = vi.fn(() => Promise.resolve())
    const router = renderShell(
      <p>Content</p>,
      true,
      '/',
      undefined,
      [],
      () => undefined,
      '7d5f46c9-3cbd-4c6d-84aa-66b8148a91aa',
      undefined,
      abandonSession,
    )

    fireEvent.click(
      within(screen.getByRole('complementary')).getByRole('link', { name: 'Nova sessão' }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Abandonar e começar outra' }))

    await vi.waitFor(() =>
      expect(abandonSession).toHaveBeenCalledWith('7d5f46c9-3cbd-4c6d-84aa-66b8148a91aa'),
    )

    await vi.waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Você tem uma sessão em andamento' }),
      ).not.toBeInTheDocument(),
    )
    expect(router.push).toHaveBeenCalledWith('/')
    expect(router.refresh).toHaveBeenCalledOnce()
  })

  it('protects history navigation while recording', () => {
    renderShell(
      <p>Content</p>,
      true,
      '/',
      undefined,
      undefined,
      () => undefined,
      '7d5f46c9-3cbd-4c6d-84aa-66b8148a91aa',
      true,
    )

    fireEvent.click(screen.getByRole('link', { name: 'Sessão' }))

    expect(
      screen.getByRole('dialog', { name: 'Você tem uma sessão em andamento' }),
    ).toBeInTheDocument()
  })

  it('closes the confirmation dialog with Escape and returns focus to its trigger', () => {
    renderShell(<p>Content</p>, true, '/', undefined, [], () => undefined, 'active-session')

    const trigger = within(screen.getByRole('complementary')).getByRole('link', {
      name: 'Nova sessão',
    })
    fireEvent.click(trigger)
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }))

    expect(
      screen.queryByRole('dialog', { name: 'Você tem uma sessão em andamento' }),
    ).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('groups the server-synchronized sessions by day, under a translated heading', () => {
    renderShell(<p>Content</p>)

    const sessions = within(screen.getByRole('complementary')).getByRole('navigation', {
      name: 'Sessões',
    })

    expect(within(sessions).getByRole('heading', { name: 'Hoje' })).toBeInTheDocument()
    expect(within(sessions).getByRole('heading', { name: '01/08/2026' })).toBeInTheDocument()
    expect(within(sessions).getByRole('link', { name: 'Notícias do dia' })).toHaveAttribute(
      'href',
      '/sessions/7d5f46c9-3cbd-4c6d-84aa-66b8148a91aa',
    )
  })

  it('names a session whose theme is unknown with the fallback copy', () => {
    renderShell(<p>Content</p>)

    const sessions = within(screen.getByRole('complementary')).getByRole('navigation', {
      name: 'Sessões',
    })

    expect(within(sessions).getByRole('link', { name: 'Sessão' })).toHaveAttribute(
      'href',
      '/sessions/3c1c9f0e-2f3a-4a1e-9a44-2a0f8f5f2f11',
    )
  })

  it('translates the previous day heading as yesterday', () => {
    renderShell(<p>Content</p>, true, '/', undefined, [
      {
        heading: { kind: 'yesterday' },
        localDate: '2026-08-24',
        items: [
          { href: '/sessions/session-1', sessionId: 'session-1', title: 'Controlar o celular' },
        ],
      },
    ])

    expect(screen.getAllByRole('heading', { name: 'Ontem' })[0]).toBeInTheDocument()
  })

  it('hides the session list while the sidebar is collapsed', () => {
    renderShell(<p>Content</p>, false)

    expect(
      within(screen.getByRole('complementary')).queryByRole('navigation', { name: 'Sessões' }),
    ).not.toBeInTheDocument()
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
      <AppRouterContext.Provider
        value={{
          back: vi.fn(),
          forward: vi.fn(),
          prefetch: vi.fn(),
          push: vi.fn(),
          refresh: vi.fn(),
          replace: vi.fn(),
        }}
      >
        <PathnameContext.Provider value="/">
          <NextIntlClientProvider locale="pt-BR" messages={messages}>
            <AuthenticatedShellView
              abandonSession={() => Promise.resolve()}
              initialIsExpanded
              preferenceCookieName="mindness-sidebar-expanded"
              signOut={() => undefined}
            >
              <p>Content</p>
            </AuthenticatedShellView>
          </NextIntlClientProvider>
        </PathnameContext.Provider>
      </AppRouterContext.Provider>,
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

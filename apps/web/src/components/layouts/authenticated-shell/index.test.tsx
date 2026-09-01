import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime'
import { PathnameContext } from 'next/dist/shared/lib/hooks-client-context.shared-runtime'
import { NextIntlClientProvider } from 'next-intl'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { messages } from '@/i18n/messages'
import { ApiClientError } from '@/lib/api/client-error'
import type { SessionDayGroup } from '@/lib/sessions/session-day-groups'

import { AuthenticatedShellView } from './index'

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

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
  deleteSession: (sessionId: string) => Promise<void> = () => Promise.resolve(),
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
            deleteSession={deleteSession}
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

function openSessionDeletion() {
  const sessions = within(screen.getByRole('complementary')).getByRole('navigation', {
    name: 'Sessões',
  })

  fireEvent.click(within(sessions).getByRole('button', { name: 'Ações de Notícias do dia' }))
  fireEvent.click(screen.getByRole('menuitem', { name: 'Excluir' }))
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

    const navigation = within(screen.getByRole('complementary')).getByRole('navigation', {
      name: 'Navegação principal',
    })
    const links = within(navigation).getAllByRole('link')

    expect(links).toHaveLength(1)
    expect(links[0]).toHaveAccessibleName('Nova sessão')
    expect(links[0]).toHaveAttribute('href', '/')
    expect(links[0]?.querySelector('[data-icon="pencil-edit-02"]')).toBeInTheDocument()
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

  it('reports a failed abandon and keeps the active session dialog open', async () => {
    const { toast } = await import('sonner')
    const abandonSession = vi.fn(() =>
      Promise.reject(
        new ApiClientError({
          code: 'web.API_REQUEST_FAILED',
          issues: null,
          message: 'Unable to reach the API.',
          requestId: null,
        }),
      ),
    )
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
      expect(toast.error).toHaveBeenCalledWith(
        'Não foi possível conectar ao servidor. Verifique sua conexão.',
      ),
    )

    expect(
      screen.getByRole('dialog', { name: 'Você tem uma sessão em andamento' }),
    ).toBeInTheDocument()
    expect(router.push).not.toHaveBeenCalledWith('/')
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

  it('opens the actions of a session from its own row in the sidebar', () => {
    renderShell(<p>Content</p>)

    const sessions = within(screen.getByRole('complementary')).getByRole('navigation', {
      name: 'Sessões',
    })
    const trigger = within(sessions).getByRole('button', { name: 'Ações de Notícias do dia' })

    fireEvent.click(trigger)

    expect(screen.getByRole('menuitem', { name: 'Excluir' })).toBeInTheDocument()
  })

  it('asks for confirmation before deleting a session', () => {
    const deleteSession = vi.fn(() => Promise.resolve())
    renderShell(
      <p>Content</p>,
      true,
      '/',
      undefined,
      undefined,
      () => undefined,
      undefined,
      false,
      undefined,
      deleteSession,
    )

    openSessionDeletion()

    expect(screen.getByRole('dialog', { name: 'Excluir esta sessão?' })).toHaveTextContent(
      'Notícias do dia',
    )
    expect(deleteSession).not.toHaveBeenCalled()
  })

  it('deletes the confirmed session and refreshes the sidebar list', async () => {
    const deleteSession = vi.fn(() => Promise.resolve())
    const router = renderShell(
      <p>Content</p>,
      true,
      '/',
      undefined,
      undefined,
      () => undefined,
      undefined,
      false,
      undefined,
      deleteSession,
    )

    openSessionDeletion()
    fireEvent.click(screen.getByRole('button', { name: 'Excluir sessão' }))

    await vi.waitFor(() =>
      expect(deleteSession).toHaveBeenCalledWith('7d5f46c9-3cbd-4c6d-84aa-66b8148a91aa'),
    )
    await vi.waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Excluir esta sessão?' }),
      ).not.toBeInTheDocument(),
    )

    expect(router.refresh).toHaveBeenCalledOnce()
    expect(router.push).not.toHaveBeenCalled()
  })

  it('leaves the analysis of the session it just deleted', async () => {
    const deleteSession = vi.fn(() => Promise.resolve())
    const router = renderShell(
      <p>Content</p>,
      true,
      '/sessions/7d5f46c9-3cbd-4c6d-84aa-66b8148a91aa',
      undefined,
      undefined,
      () => undefined,
      undefined,
      false,
      undefined,
      deleteSession,
    )

    openSessionDeletion()
    fireEvent.click(screen.getByRole('button', { name: 'Excluir sessão' }))

    await vi.waitFor(() => expect(router.push).toHaveBeenCalledWith('/'))

    expect(router.refresh).toHaveBeenCalledOnce()
  })

  it('reports a session that is still processing and keeps the dialog open', async () => {
    const { toast } = await import('sonner')
    const deleteSession = vi.fn(() =>
      Promise.reject(
        new ApiClientError({
          code: 'sessions.SESSION_NOT_DELETABLE',
          issues: null,
          message: 'Session cannot be deleted',
          requestId: null,
        }),
      ),
    )
    const router = renderShell(
      <p>Content</p>,
      true,
      '/',
      undefined,
      undefined,
      () => undefined,
      undefined,
      false,
      undefined,
      deleteSession,
    )

    openSessionDeletion()
    fireEvent.click(screen.getByRole('button', { name: 'Excluir sessão' }))

    await vi.waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        'Não é possível excluir uma sessão em processamento. Tente de novo quando a análise terminar.',
      ),
    )

    expect(screen.getByRole('dialog', { name: 'Excluir esta sessão?' })).toBeInTheDocument()
    expect(router.refresh).not.toHaveBeenCalled()
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

  it('renders a submit control for signing out inside the account popup', () => {
    renderShell(<p>Content</p>)

    const railSidebar = screen.getByRole('complementary')
    const railAccount = within(railSidebar).getByRole('button', { name: 'Conta' })
    fireEvent.click(railAccount)

    const railSignOut = within(screen.getByRole('dialog', { name: 'Conta' })).getByRole('button', {
      name: 'Sair',
    })

    expect(railSignOut).toHaveAttribute('type', 'submit')
    expect(railSignOut.closest('form')).not.toBeNull()

    fireEvent.click(railAccount)

    fireEvent.click(within(screen.getByRole('banner')).getByLabelText('Abrir navegação'))

    const mobileSidebar = screen.getByRole('dialog', { name: 'Navegação do aplicativo' })
    fireEvent.click(within(mobileSidebar).getByRole('button', { name: 'Conta' }))

    const mobileSignOut = within(screen.getByRole('dialog', { name: 'Conta' })).getByRole(
      'button',
      {
        name: 'Sair',
      },
    )

    expect(mobileSignOut).toHaveAttribute('type', 'submit')
    expect(mobileSignOut.closest('form')).not.toBeNull()
  })

  it('renders the account control in desktop and mobile sidebars', () => {
    renderShell(<p>Content</p>)

    const railSidebar = screen.getByRole('complementary')
    const railAccount = within(railSidebar).getByRole('button', { name: 'Conta' })

    expect(railAccount).toHaveTextContent('Mindness')
    expect(railAccount).toHaveTextContent('Plano gratuito')

    fireEvent.click(within(screen.getByRole('banner')).getByLabelText('Abrir navegação'))

    const mobileSidebar = screen.getByRole('dialog', { name: 'Navegação do aplicativo' })
    const mobileAccount = within(mobileSidebar).getByRole('button', { name: 'Conta' })

    expect(mobileAccount).toHaveTextContent('Mindness')
    expect(mobileAccount).toHaveTextContent('Plano gratuito')
  })

  it('highlights the navigation item matching the current route', () => {
    renderShell(<p>Content</p>)

    expect(
      within(screen.getByRole('complementary')).getByRole('link', { name: 'Nova sessão' }),
    ).toHaveClass('bg-input')
  })

  it('leaves the navigation unhighlighted outside its routes', () => {
    renderShell(<p>Content</p>, true, '/sessions/7d5f46c9-3cbd-4c6d-84aa-66b8148a91aa')

    expect(
      within(screen.getByRole('complementary')).getByRole('link', { name: 'Nova sessão' }),
    ).not.toHaveClass('bg-input')
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
              deleteSession={() => Promise.resolve()}
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

    fireEvent.click(screen.getByRole('button', { name: 'Conta' }))
    fireEvent.click(screen.getByRole('button', { name: 'Sair' }))

    expect(signOut).toHaveBeenCalledOnce()
  })
})

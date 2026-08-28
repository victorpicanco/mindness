import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { Sidebar, SidebarHeader, SidebarNavigation, SidebarSessionGroups } from './index'
import type { SidebarNavigationItem, SidebarSessionGroup, SidebarSessionItem } from './types'

const groups: readonly SidebarSessionGroup[] = [
  {
    heading: 'Hoje',
    key: '2026-08-25',
    items: [
      { href: '/sessions/session-1', label: 'Notícias do dia', sessionId: 'session-1' },
      { href: '/sessions/session-2', label: 'Controlar o celular', sessionId: 'session-2' },
    ],
  },
  {
    heading: '01/08/2026',
    key: '2026-08-01',
    items: [{ href: '/sessions/session-3', label: 'Sessão sem tema', sessionId: 'session-3' }],
  },
]

function renderSessionGroups(
  activeHref: string | null = null,
  onNavigate?: () => void,
  renderItemAction?: (item: SidebarSessionItem) => ReactNode,
) {
  return render(
    <SidebarSessionGroups
      activeHref={activeHref}
      groups={groups}
      label="Sessões"
      onNavigate={onNavigate}
      renderItemAction={renderItemAction}
    />,
  )
}

const items: readonly SidebarNavigationItem[] = [
  { href: '/', icon: 'pencil-edit-02', label: 'Nova sessão' },
  { href: '/sessions', icon: 'chart-increase', label: 'Sessões' },
]

function renderNavigation(activeHref: string | null, isExpanded = true, onNavigate?: () => void) {
  return render(
    <SidebarNavigation
      activeHref={activeHref}
      isExpanded={isExpanded}
      items={items}
      label="Navegação principal"
      onNavigate={onNavigate}
    />,
  )
}

describe('Sidebar', () => {
  afterEach(cleanup)

  it('renders a complementary landmark with the rail styles by default', () => {
    render(<Sidebar aria-label="Navegação do aplicativo" className="w-64" />)

    expect(screen.getByRole('complementary', { name: 'Navegação do aplicativo' })).toHaveClass(
      'hidden',
      'md:flex',
      'border-r',
      'w-64',
    )
  })

  it('renders the drawer variant with the forwarded aside attributes', () => {
    render(
      <Sidebar
        aria-label="Navegação do aplicativo"
        className="-translate-x-full"
        id="mobile-authenticated-sidebar"
        role="dialog"
        variant="drawer"
      />,
    )

    const drawer = screen.getByRole('dialog', { name: 'Navegação do aplicativo' })

    expect(drawer).toHaveAttribute('id', 'mobile-authenticated-sidebar')
    expect(drawer).toHaveClass('fixed', 'z-50', 'md:hidden', '-translate-x-full')
  })
})

describe('SidebarHeader', () => {
  afterEach(cleanup)

  it('lays its children out on a single row', () => {
    const { container } = render(
      <SidebarHeader>
        <span>brand</span>
      </SidebarHeader>,
    )

    expect(container.firstElementChild).toHaveClass('flex', 'items-center', 'justify-between')
  })
})

describe('SidebarNavigation', () => {
  afterEach(cleanup)

  it('renders one labelled link per item, in order, with its icon', () => {
    renderNavigation('/')

    const navigation = screen.getByRole('navigation', { name: 'Navegação principal' })
    const links = within(navigation).getAllByRole('link')

    expect(links).toHaveLength(2)
    expect(links[0]).toHaveAccessibleName('Nova sessão')
    expect(links[0]).toHaveAttribute('href', '/')
    expect(links[0]?.querySelector('[data-icon="pencil-edit-02"]')).toBeInTheDocument()
    expect(links[1]).toHaveAccessibleName('Sessões')
    expect(links[1]).toHaveAttribute('href', '/sessions')
    expect(links[1]?.querySelector('[data-icon="chart-increase"]')).toBeInTheDocument()
  })

  it('highlights only the item matching the active path', () => {
    renderNavigation('/sessions')

    expect(screen.getByRole('link', { name: 'Sessões' })).toHaveClass('bg-input')
    expect(screen.getByRole('link', { name: 'Sessões' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Nova sessão' })).not.toHaveClass('bg-input')
    expect(screen.getByRole('link', { name: 'Nova sessão' })).not.toHaveAttribute('aria-current')
  })

  it('keeps a section active on its nested routes without activating the root item', () => {
    renderNavigation('/sessions/2026-08-24')

    expect(screen.getByRole('link', { name: 'Sessões' })).toHaveClass('bg-input')
    expect(screen.getByRole('link', { name: 'Nova sessão' })).not.toHaveClass('bg-input')
  })

  it('highlights nothing while the active path is unknown', () => {
    renderNavigation(null)

    for (const link of screen.getAllByRole('link')) {
      expect(link).not.toHaveClass('bg-input')
    }
  })

  it('keeps icons anchored while smoothly hiding collapsed labels', () => {
    const { rerender } = render(
      <SidebarNavigation activeHref="/" isExpanded items={items} label="Navegação principal" />,
    )

    const expandedLink = screen.getByRole('link', { name: 'Nova sessão' })
    const expandedIconSlot = expandedLink.querySelector('[data-sidebar-icon]')
    const expandedLabel = within(expandedLink).getByText('Nova sessão')

    expect(expandedLink).toHaveClass('grid-cols-[2.25rem_minmax(0,1fr)]')
    expect(expandedIconSlot).toHaveClass('grid', 'size-9', 'place-items-center')
    expect(expandedLabel).toHaveClass('opacity-100', 'translate-x-0')

    rerender(
      <SidebarNavigation
        activeHref="/"
        isExpanded={false}
        items={items}
        label="Navegação principal"
      />,
    )

    const collapsedLink = screen.getByRole('link', { name: 'Nova sessão' })
    const collapsedIconSlot = collapsedLink.querySelector('[data-sidebar-icon]')
    const collapsedLabel = within(collapsedLink).getByText('Nova sessão')

    expect(collapsedLink).toHaveClass('grid-cols-[2.25rem_minmax(0,1fr)]')
    expect(collapsedIconSlot).toHaveClass('grid', 'size-9', 'place-items-center')
    expect(collapsedLabel).toHaveClass('pointer-events-none', '-translate-x-1', 'opacity-0')
    expect(collapsedLabel).toHaveAttribute('aria-hidden', 'true')
  })

  it('uses the compact rhythm of the application navigation', () => {
    renderNavigation('/')

    const navigation = screen.getByRole('navigation', { name: 'Navegação principal' })
    const link = screen.getByRole('link', { name: 'Nova sessão' })
    const iconSlot = link.querySelector('[data-sidebar-icon]')
    const label = within(link).getByText('Nova sessão')

    expect(navigation).toHaveClass('mt-6', 'gap-1')
    expect(link).toHaveClass('h-10', 'grid-cols-[2.25rem_minmax(0,1fr)]', 'rounded-xl')
    expect(iconSlot).toHaveClass('size-9')
    expect(label).toHaveClass('text-[0.9375rem]', 'font-normal')
  })

  it('notifies the consumer when an item is followed', () => {
    const onNavigate = vi.fn()
    renderNavigation('/', true, onNavigate)

    fireEvent.click(screen.getByRole('link', { name: 'Sessões' }))

    expect(onNavigate).toHaveBeenCalledOnce()
  })
})

describe('SidebarSessionGroups', () => {
  afterEach(cleanup)

  it('renders one labelled list per day, in the order it receives them', () => {
    renderSessionGroups()

    const navigation = screen.getByRole('navigation', { name: 'Sessões' })
    const lists = within(navigation).getAllByRole('list')

    expect(within(navigation).getByRole('heading', { name: 'Hoje' })).toBeInTheDocument()
    expect(within(navigation).getByRole('heading', { name: '01/08/2026' })).toBeInTheDocument()
    expect(lists).toHaveLength(2)
    expect(within(lists[0] ?? navigation).getAllByRole('link')).toHaveLength(2)
    expect(within(lists[1] ?? navigation).getAllByRole('link')).toHaveLength(1)
    expect(lists[0]).toHaveAccessibleName('Hoje')
    expect(lists[1]).toHaveAccessibleName('01/08/2026')
  })

  it('links each session by its own path and keeps the title on a single line', () => {
    renderSessionGroups()

    const link = screen.getByRole('link', { name: 'Notícias do dia' })

    expect(link).toHaveAttribute('href', '/sessions/session-1')
    expect(within(link).getByText('Notícias do dia')).toHaveClass('truncate')
  })

  it('renders the action of each session beside its link, never inside it', () => {
    renderSessionGroups(null, undefined, (item) => (
      <button type="button">{`Ações de ${item.label}`}</button>
    ))

    const action = screen.getByRole('button', { name: 'Ações de Notícias do dia' })
    const link = screen.getByRole('link', { name: 'Notícias do dia' })

    expect(screen.getAllByRole('button')).toHaveLength(3)
    expect(link).not.toContainElement(action)
    expect(action.parentElement).toHaveClass('absolute', 'right-1.5')
  })

  it('keeps the row highlighted while the pointer is over the action beside it', () => {
    renderSessionGroups(null, undefined, () => <button type="button">Ações</button>)

    const link = screen.getByRole('link', { name: 'Notícias do dia' })

    expect(link.parentElement).toHaveClass('group')
    expect(link).toHaveClass('group-hover:bg-input', 'group-hover:text-text')
  })

  it('fades a long title under the action instead of cutting it with an ellipsis', () => {
    renderSessionGroups(null, undefined, () => <button type="button">Ações</button>)

    const label = within(screen.getByRole('link', { name: 'Notícias do dia' })).getByText(
      'Notícias do dia',
    )

    expect(label).not.toHaveClass('truncate')
    expect(label).toHaveClass(
      'overflow-hidden',
      'whitespace-nowrap',
      '[mask-image:linear-gradient(to_right,#000_calc(100%-2.25rem),transparent)]',
    )
  })

  it('highlights only the session of the active path', () => {
    renderSessionGroups('/sessions/session-2')

    expect(screen.getByRole('link', { name: 'Controlar o celular' })).toHaveClass('bg-input')
    expect(screen.getByRole('link', { name: 'Controlar o celular' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(screen.getByRole('link', { name: 'Notícias do dia' })).not.toHaveClass('bg-input')
  })

  it('scrolls on its own so the sign-out control stays in place', () => {
    renderSessionGroups()

    expect(screen.getByRole('navigation', { name: 'Sessões' })).toHaveClass(
      'min-h-0',
      'flex-1',
      'overflow-y-auto',
    )
  })

  it('notifies the consumer when a session is followed', () => {
    const onNavigate = vi.fn()
    renderSessionGroups(null, onNavigate)

    fireEvent.click(screen.getByRole('link', { name: 'Notícias do dia' }))

    expect(onNavigate).toHaveBeenCalledOnce()
  })

  it('renders nothing when there is no session to list', () => {
    const { container } = render(
      <SidebarSessionGroups activeHref={null} groups={[]} label="Sessões" />,
    )

    expect(container).toBeEmptyDOMElement()
  })
})

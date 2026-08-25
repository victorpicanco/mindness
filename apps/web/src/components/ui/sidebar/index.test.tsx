import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { Sidebar, SidebarHeader, SidebarNavigation } from './index'
import type { SidebarNavigationItem } from './types'

const items: readonly SidebarNavigationItem[] = [
  { href: '/', icon: 'pencil-edit-02', label: 'Nova sessão' },
  { href: '/history', icon: 'chart-increase', label: 'Seu progresso' },
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
    expect(links[1]).toHaveAccessibleName('Seu progresso')
    expect(links[1]).toHaveAttribute('href', '/history')
    expect(links[1]?.querySelector('[data-icon="chart-increase"]')).toBeInTheDocument()
  })

  it('highlights only the item matching the active path', () => {
    renderNavigation('/history')

    expect(screen.getByRole('link', { name: 'Seu progresso' })).toHaveClass('bg-input')
    expect(screen.getByRole('link', { name: 'Seu progresso' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(screen.getByRole('link', { name: 'Nova sessão' })).not.toHaveClass('bg-input')
    expect(screen.getByRole('link', { name: 'Nova sessão' })).not.toHaveAttribute('aria-current')
  })

  it('keeps a section active on its nested routes without activating the root item', () => {
    renderNavigation('/history/2026-08-24')

    expect(screen.getByRole('link', { name: 'Seu progresso' })).toHaveClass('bg-input')
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

    fireEvent.click(screen.getByRole('link', { name: 'Seu progresso' }))

    expect(onNavigate).toHaveBeenCalledOnce()
  })
})

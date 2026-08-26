import { cva, type VariantProps } from 'class-variance-authority'
import Link from 'next/link'
import type { ComponentPropsWithRef, MouseEvent, ReactNode } from 'react'

import { Icon } from '@/components/ui/icon'

import type { SidebarNavigationItem, SidebarSessionGroup } from './types'

const sidebarStyles = cva('flex-col overflow-hidden border-divider p-3', {
  variants: {
    variant: {
      rail: 'relative hidden shrink-0 border-r transition-[width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none md:flex',
      drawer:
        'fixed inset-y-0 left-0 z-50 flex w-64 border-r bg-surface shadow-xl transition-transform duration-200 ease-out motion-reduce:transition-none md:hidden',
    },
  },
  defaultVariants: {
    variant: 'rail',
  },
})

const navigationLinkStyles = cva(
  'relative z-10 grid h-10 grid-cols-[2.25rem_minmax(0,1fr)] items-center overflow-hidden rounded-xl text-text transition-colors hover:bg-input focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text',
  {
    variants: {
      isActive: {
        true: 'bg-input',
        false: '',
      },
    },
  },
)

const sessionLinkStyles = cva(
  'flex h-9 items-center rounded-lg px-3 text-[0.875rem] font-normal text-text-muted transition-colors hover:bg-input hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text',
  {
    variants: {
      isActive: {
        true: 'bg-input text-text',
        false: '',
      },
    },
  },
)

type SidebarProps = ComponentPropsWithRef<'aside'> & VariantProps<typeof sidebarStyles>

export function Sidebar({ className, variant, ...props }: SidebarProps) {
  return <aside className={sidebarStyles({ className, variant })} {...props} />
}

interface SidebarHeaderProps {
  readonly children: ReactNode
}

export function SidebarHeader({ children }: SidebarHeaderProps) {
  return <div className="flex items-center justify-between gap-2">{children}</div>
}

interface SidebarNavigationProps {
  readonly activeHref: string | null
  readonly isExpanded: boolean
  readonly items: readonly SidebarNavigationItem[]
  readonly label: string
  readonly onNavigate?:
    ((item: SidebarNavigationItem, event: MouseEvent<HTMLAnchorElement>) => void) | undefined
}

function isItemActive(href: string, activeHref: string | null): boolean {
  if (activeHref === null) return false
  if (href === '/') return activeHref === '/'

  return activeHref === href || activeHref.startsWith(`${href}/`)
}

interface SidebarNavigationLinkProps {
  readonly isActive: boolean
  readonly isExpanded: boolean
  readonly item: SidebarNavigationItem
  readonly onNavigate?:
    ((item: SidebarNavigationItem, event: MouseEvent<HTMLAnchorElement>) => void) | undefined
}

function SidebarNavigationLink({
  isActive,
  isExpanded,
  item,
  onNavigate,
}: SidebarNavigationLinkProps) {
  return (
    <Link
      aria-current={isActive ? 'page' : undefined}
      aria-label={isExpanded ? undefined : item.label}
      className={navigationLinkStyles({ isActive })}
      href={item.href}
      onClick={(event) => onNavigate?.(item, event)}
    >
      <span className="grid size-9 place-items-center" data-sidebar-icon>
        <Icon className="text-lg" name={item.icon} />
      </span>
      <span
        aria-hidden={!isExpanded}
        className={`min-w-0 whitespace-nowrap text-[0.9375rem] font-normal transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none ${isExpanded ? 'translate-x-0 opacity-100' : 'pointer-events-none -translate-x-1 opacity-0'}`}
      >
        {item.label}
      </span>
    </Link>
  )
}

export function SidebarNavigation({
  activeHref,
  isExpanded,
  items,
  label,
  onNavigate,
}: SidebarNavigationProps) {
  return (
    <nav aria-label={label} className="mt-6 flex flex-col gap-1">
      {items.map((item) => (
        <SidebarNavigationLink
          isActive={isItemActive(item.href, activeHref)}
          isExpanded={isExpanded}
          item={item}
          key={item.href}
          onNavigate={onNavigate}
        />
      ))}
    </nav>
  )
}

interface SidebarSessionGroupsProps {
  readonly activeHref: string | null
  readonly groups: readonly SidebarSessionGroup[]
  readonly label: string
  readonly onNavigate?:
    | ((item: SidebarSessionGroup['items'][number], event: MouseEvent<HTMLAnchorElement>) => void)
    | undefined
}

export function SidebarSessionGroups({
  activeHref,
  groups,
  label,
  onNavigate,
}: SidebarSessionGroupsProps) {
  if (groups.length === 0) return null

  return (
    <nav
      aria-label={label}
      className="mt-6 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1"
    >
      {groups.map((group) => (
        <div key={group.key}>
          <h2
            className="px-3 pb-1 text-[0.75rem] font-medium text-text-muted"
            id={`sidebar-session-group-${group.key}`}
          >
            {group.heading}
          </h2>

          <ul aria-labelledby={`sidebar-session-group-${group.key}`} className="flex flex-col">
            {group.items.map((item) => (
              <li key={item.sessionId}>
                <Link
                  aria-current={item.href === activeHref ? 'page' : undefined}
                  className={sessionLinkStyles({ isActive: item.href === activeHref })}
                  href={item.href}
                  onClick={(event) => onNavigate?.(item, event)}
                >
                  <span className="truncate">{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}

export type { SidebarNavigationItem, SidebarSessionGroup, SidebarSessionItem } from './types'

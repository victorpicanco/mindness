import { cva, type VariantProps } from 'class-variance-authority'
import Link from 'next/link'
import type { ComponentPropsWithRef, ReactNode } from 'react'

import { Icon } from '@/components/ui/icon'

import type { SidebarNavigationItem } from './types'

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
  readonly onNavigate?: (() => void) | undefined
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
  readonly onNavigate?: (() => void) | undefined
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
      onClick={() => onNavigate?.()}
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

export type { SidebarNavigationItem } from './types'

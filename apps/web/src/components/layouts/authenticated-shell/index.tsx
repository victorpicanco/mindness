'use client'

import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'

import { BrandLink } from '@/components/layouts/brand-link'
import { Header } from '@/components/layouts/header'
import { IconButton } from '@/components/ui/icon-button'
import {
  Sidebar,
  SidebarHeader,
  SidebarNavigation,
  type SidebarNavigationItem,
} from '@/components/ui/sidebar'
import { AUTHENTICATED_NAVIGATION_ITEMS } from '@/lib/navigation/authenticated-navigation'

interface AuthenticatedShellProps {
  readonly children: ReactNode
  readonly initialIsExpanded: boolean
  readonly preferenceCookieName: string
}

const ONE_YEAR_IN_SECONDS = 31_536_000
const RAIL_SIDEBAR_ID = 'authenticated-sidebar'
const DRAWER_SIDEBAR_ID = 'mobile-authenticated-sidebar'

export function AuthenticatedShell({
  children,
  initialIsExpanded,
  preferenceCookieName,
}: AuthenticatedShellProps) {
  const t = useTranslations('common.authenticatedShell')
  const activeHref = usePathname()
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(initialIsExpanded)
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const mobileToggleRef = useRef<HTMLButtonElement>(null)
  const mobileCloseRef = useRef<HTMLButtonElement>(null)
  const controlLabel = isSidebarExpanded ? t('collapseSidebar') : t('expandSidebar')
  const navigationItems: readonly SidebarNavigationItem[] = AUTHENTICATED_NAVIGATION_ITEMS.map(
    (item) => ({ href: item.href, icon: item.icon, label: t(item.labelKey) }),
  )

  useEffect(() => {
    if (!isMobileSidebarOpen) return

    const previousOverflow = document.body.style.overflow
    const mobileToggle = mobileToggleRef.current

    document.body.style.overflow = 'hidden'
    mobileCloseRef.current?.focus()

    function closeSidebarOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsMobileSidebarOpen(false)
    }

    window.addEventListener('keydown', closeSidebarOnEscape)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeSidebarOnEscape)
      mobileToggle?.focus()
    }
  }, [isMobileSidebarOpen])

  function toggleSidebarExpanded() {
    const nextIsExpanded = !isSidebarExpanded
    setIsSidebarExpanded(nextIsExpanded)
    document.cookie = `${preferenceCookieName}=${String(nextIsExpanded)}; Path=/; Max-Age=${String(ONE_YEAR_IN_SECONDS)}; SameSite=Lax`
  }

  function closeMobileSidebar() {
    setIsMobileSidebarOpen(false)
  }

  return (
    <div className="flex min-h-dvh bg-surface text-text">
      <div
        aria-hidden={isMobileSidebarOpen || undefined}
        className="contents"
        inert={isMobileSidebarOpen}
      >
        <Sidebar
          aria-label={t('navigationLabel')}
          className={isSidebarExpanded ? 'w-64' : 'w-16 cursor-col-resize'}
          id={RAIL_SIDEBAR_ID}
        >
          {isSidebarExpanded ? (
            <SidebarHeader>
              <BrandLink label={t('homeLabel')} logoAlt={t('logoAlt')} />

              <IconButton
                aria-controls={RAIL_SIDEBAR_ID}
                aria-expanded={isSidebarExpanded}
                icon="sidebar-left"
                label={controlLabel}
                onClick={toggleSidebarExpanded}
              />
            </SidebarHeader>
          ) : (
            <>
              <button
                aria-controls={RAIL_SIDEBAR_ID}
                aria-expanded={isSidebarExpanded}
                aria-label={controlLabel}
                className="absolute inset-0 cursor-col-resize focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-text"
                onClick={toggleSidebarExpanded}
                type="button"
              />

              <BrandLink
                className="relative z-10 cursor-pointer"
                label={t('homeLabel')}
                logoAlt={t('logoAlt')}
              />
            </>
          )}

          <SidebarNavigation
            activeHref={activeHref}
            isExpanded={isSidebarExpanded}
            items={navigationItems}
            label={t('primaryNavigationLabel')}
          />
        </Sidebar>

        <div className="flex min-w-0 flex-1 flex-col">
          <Header
            leftItem={
              <IconButton
                aria-controls={DRAWER_SIDEBAR_ID}
                aria-expanded={isMobileSidebarOpen}
                icon="menu-01"
                label={t('openNavigation')}
                onClick={() => setIsMobileSidebarOpen(true)}
                ref={mobileToggleRef}
              />
            }
          />

          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </div>

      <div aria-hidden={!isMobileSidebarOpen} className="contents" inert={!isMobileSidebarOpen}>
        <button
          aria-label={t('closeNavigation')}
          className={`fixed inset-0 z-40 cursor-pointer bg-text/30 backdrop-blur-[1px] transition-opacity duration-200 ease-out motion-reduce:backdrop-filter-none motion-reduce:transition-none md:hidden ${isMobileSidebarOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`}
          onClick={closeMobileSidebar}
          type="button"
        />

        <Sidebar
          aria-label={t('navigationLabel')}
          aria-modal={isMobileSidebarOpen || undefined}
          className={isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          id={DRAWER_SIDEBAR_ID}
          role="dialog"
          variant="drawer"
        >
          <SidebarHeader>
            <BrandLink label={t('homeLabel')} logoAlt={t('logoAlt')} onClick={closeMobileSidebar} />

            <IconButton
              icon="cancel-01"
              label={t('closeNavigation')}
              onClick={closeMobileSidebar}
              ref={mobileCloseRef}
            />
          </SidebarHeader>

          <SidebarNavigation
            activeHref={activeHref}
            isExpanded
            items={navigationItems}
            label={t('primaryNavigationLabel')}
            onNavigate={closeMobileSidebar}
          />
        </Sidebar>
      </div>
    </div>
  )
}

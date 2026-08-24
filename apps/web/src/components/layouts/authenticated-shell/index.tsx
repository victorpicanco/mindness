'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'

import { Header } from '@/components/layouts/header'

interface AuthenticatedShellProps {
  readonly children: ReactNode
  readonly initialIsExpanded: boolean
  readonly preferenceCookieName: string
}

const ONE_YEAR_IN_SECONDS = 31_536_000

export function AuthenticatedShell({
  children,
  initialIsExpanded,
  preferenceCookieName,
}: AuthenticatedShellProps) {
  const t = useTranslations('common.authenticatedShell')
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(initialIsExpanded)
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const mobileToggleRef = useRef<HTMLButtonElement>(null)
  const mobileCloseRef = useRef<HTMLButtonElement>(null)
  const controlLabel = isSidebarExpanded ? t('collapseSidebar') : t('expandSidebar')

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

  return (
    <div className="flex min-h-dvh bg-surface text-text">
      <div
        aria-hidden={isMobileSidebarOpen || undefined}
        className="contents"
        inert={isMobileSidebarOpen}
      >
        <aside
          aria-label={t('navigationLabel')}
          className={`relative hidden shrink-0 flex-col border-r border-divider p-3 transition-[width] duration-200 ease-out motion-reduce:transition-none md:flex ${isSidebarExpanded ? 'w-64' : 'w-16 cursor-col-resize'}`}
          id="authenticated-sidebar"
        >
          {isSidebarExpanded ? (
            <div className="flex items-center justify-between gap-2">
              <Link
                aria-label={t('homeLabel')}
                className="grid size-10 shrink-0 place-items-center rounded-[0.875rem] transition-colors hover:bg-input focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text"
                href="/"
              >
                <Image alt={t('logoAlt')} height={28} priority src="/logo-icon.svg" width={28} />
              </Link>

              <button
                aria-controls="authenticated-sidebar"
                aria-expanded={isSidebarExpanded}
                aria-label={controlLabel}
                className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-[0.875rem] text-text-muted transition-colors hover:bg-input hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text"
                onClick={toggleSidebarExpanded}
                type="button"
              >
                <span aria-hidden="true" className="hgi-stroke hgi-sidebar-left text-xl" />
              </button>
            </div>
          ) : (
            <>
              <button
                aria-controls="authenticated-sidebar"
                aria-expanded={isSidebarExpanded}
                aria-label={controlLabel}
                className="absolute inset-0 cursor-col-resize focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-text"
                onClick={toggleSidebarExpanded}
                type="button"
              />

              <Link
                aria-label={t('homeLabel')}
                className="relative z-10 grid size-10 shrink-0 cursor-pointer place-items-center rounded-[0.875rem] transition-colors hover:bg-input focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text"
                href="/"
              >
                <Image alt={t('logoAlt')} height={28} priority src="/logo-icon.svg" width={28} />
              </Link>
            </>
          )}
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <Header
            leftItem={
              <button
                aria-controls="mobile-authenticated-sidebar"
                aria-expanded={isMobileSidebarOpen}
                aria-label={t('openNavigation')}
                className="grid size-10 cursor-pointer place-items-center rounded-[0.875rem] text-text-muted transition-colors hover:bg-input hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text"
                onClick={() => setIsMobileSidebarOpen(true)}
                ref={mobileToggleRef}
                type="button"
              >
                <span aria-hidden="true" className="hgi-stroke hgi-menu-01 text-xl" />
              </button>
            }
          />

          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </div>

      <div aria-hidden={!isMobileSidebarOpen} className="contents" inert={!isMobileSidebarOpen}>
        <button
          aria-label={t('closeNavigation')}
          className={`fixed inset-0 z-40 cursor-pointer bg-text/30 backdrop-blur-[1px] transition-opacity duration-200 ease-out motion-reduce:backdrop-filter-none motion-reduce:transition-none md:hidden ${isMobileSidebarOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`}
          onClick={() => setIsMobileSidebarOpen(false)}
          type="button"
        />

        <aside
          aria-label={t('navigationLabel')}
          aria-modal={isMobileSidebarOpen || undefined}
          className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-divider bg-surface p-3 shadow-xl transition-transform duration-200 ease-out motion-reduce:transition-none md:hidden ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
          id="mobile-authenticated-sidebar"
          role="dialog"
        >
          <div className="flex items-center justify-between gap-2">
            <Link
              aria-label={t('homeLabel')}
              className="grid size-10 shrink-0 place-items-center rounded-[0.875rem] transition-colors hover:bg-input focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text"
              href="/"
              onClick={() => setIsMobileSidebarOpen(false)}
            >
              <Image alt={t('logoAlt')} height={28} priority src="/logo-icon.svg" width={28} />
            </Link>

            <button
              aria-label={t('closeNavigation')}
              className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-[0.875rem] text-text-muted transition-colors hover:bg-input hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text"
              onClick={() => setIsMobileSidebarOpen(false)}
              ref={mobileCloseRef}
              type="button"
            >
              <span aria-hidden="true" className="hgi-stroke hgi-cancel-01 text-xl" />
            </button>
          </div>
        </aside>
      </div>
    </div>
  )
}

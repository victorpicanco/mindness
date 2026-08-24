'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import type { ReactNode } from 'react'
import { useState } from 'react'

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
  const controlLabel = isSidebarExpanded ? t('collapseSidebar') : t('expandSidebar')

  function toggleSidebarExpanded() {
    const nextIsExpanded = !isSidebarExpanded
    setIsSidebarExpanded(nextIsExpanded)
    document.cookie = `${preferenceCookieName}=${String(nextIsExpanded)}; Path=/; Max-Age=${String(ONE_YEAR_IN_SECONDS)}; SameSite=Lax`
  }

  return (
    <div className="flex min-h-dvh bg-surface text-text">
      <aside
        aria-label={t('navigationLabel')}
        className={`relative flex shrink-0 flex-col border-r border-divider p-3 transition-[width] duration-200 ease-out motion-reduce:transition-none ${isSidebarExpanded ? 'w-64' : 'w-16 cursor-col-resize'}`}
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

      <main className="min-w-0 flex-1">{children}</main>
    </div>
  )
}

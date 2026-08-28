'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import type { MouseEvent, ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'

import { BrandLink } from '@/components/layouts/brand-link'
import { Header } from '@/components/layouts/header'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { IconButton } from '@/components/ui/icon-button'
import { Icon } from '@/components/ui/icon'
import { Menu } from '@/components/ui/menu'
import {
  Sidebar,
  SidebarHeader,
  SidebarNavigation,
  SidebarSessionGroups,
  type SidebarNavigationItem,
  type SidebarSessionGroup,
  type SidebarSessionItem,
} from '@/components/ui/sidebar'
import { AUTHENTICATED_NAVIGATION_ITEMS } from '@/lib/navigation/authenticated-navigation'
import { sessionPath } from '@/lib/navigation/session-routes'
import type { SessionDayGroup, SessionDayHeading } from '@/lib/sessions/session-day-groups'
import { abandonSession as abandonSessionRequest } from '@/lib/api/abandon-session'
import { deleteSession as deleteSessionRequest } from '@/lib/api/delete-session'
import { apiErrorDetails } from '@/lib/api/api-error'
import { showApiErrorToast } from '@/lib/errors/show-api-error-toast'
import { cn } from '@/lib/ui/class-names'

export interface AuthenticatedShellProps {
  readonly activeSessionId?: string | undefined
  readonly children: ReactNode
  readonly header?: ReactNode | undefined
  readonly initialIsExpanded: boolean
  readonly preferenceCookieName: string
  readonly sessionGroups?: readonly SessionDayGroup[] | undefined
  readonly onSessionAbandoned?: (() => void) | undefined
  readonly shouldConfirmSessionNavigation?: boolean | undefined
  readonly signOut: SignOutAction
}

type AuthenticatedShellViewProps = AuthenticatedShellProps & {
  readonly abandonSession: (sessionId: string) => Promise<void>
  readonly deleteSession: (sessionId: string) => Promise<void>
}

const ONE_YEAR_IN_SECONDS = 31_536_000
const RAIL_SIDEBAR_ID = 'authenticated-sidebar'
const DRAWER_SIDEBAR_ID = 'mobile-authenticated-sidebar'

type SignOutAction = () => void | Promise<void>

interface SignOutControlProps {
  readonly isExpanded: boolean
  readonly label: string
  readonly signOut: SignOutAction
}

function SignOutControl({ isExpanded, label, signOut }: SignOutControlProps) {
  return (
    <form action={signOut} className="mt-auto pt-4">
      <button
        aria-label={isExpanded ? undefined : label}
        className={cn(
          'relative z-10 h-10 w-full cursor-pointer items-center overflow-hidden rounded-xl text-text-muted transition-colors hover:bg-input hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text',
          isExpanded ? 'grid grid-cols-[2.25rem_minmax(0,1fr)]' : 'grid place-items-center',
        )}
        type="submit"
      >
        <span className="grid size-9 place-items-center">
          <Icon className="text-lg" name="logout-01" />
        </span>
        {isExpanded ? (
          <span className="text-left text-[0.9375rem] font-normal">{label}</span>
        ) : null}
      </button>
    </form>
  )
}

interface SidebarBodyProps {
  readonly activeHref: string | null
  readonly isExpanded: boolean
  readonly labels: Readonly<Record<'primaryNavigation' | 'sessions' | 'signOut', string>>
  readonly navigationItems: readonly SidebarNavigationItem[]
  readonly onPrimaryNavigate: (
    item: SidebarNavigationItem,
    event: MouseEvent<HTMLAnchorElement>,
  ) => void
  readonly onSessionNavigate: (
    item: SidebarSessionGroup['items'][number],
    event: MouseEvent<HTMLAnchorElement>,
  ) => void
  readonly renderSessionAction: (item: SidebarSessionItem) => ReactNode
  readonly sessionGroups: readonly SidebarSessionGroup[]
  readonly showSessionGroups: boolean
  readonly signOut: SignOutAction
}

// The rail and the drawer are two presentations of the same navigation, so everything below their
// headers is rendered from here instead of being written twice.
function SidebarBody({
  activeHref,
  isExpanded,
  labels,
  navigationItems,
  onPrimaryNavigate,
  onSessionNavigate,
  renderSessionAction,
  sessionGroups,
  showSessionGroups,
  signOut,
}: SidebarBodyProps) {
  return (
    <>
      <SidebarNavigation
        activeHref={activeHref}
        isExpanded={isExpanded}
        items={navigationItems}
        label={labels.primaryNavigation}
        onNavigate={onPrimaryNavigate}
      />
      {showSessionGroups ? (
        <SidebarSessionGroups
          activeHref={activeHref}
          groups={sessionGroups}
          label={labels.sessions}
          onNavigate={onSessionNavigate}
          renderItemAction={renderSessionAction}
        />
      ) : null}
      <SignOutControl isExpanded={isExpanded} label={labels.signOut} signOut={signOut} />
    </>
  )
}

export function AuthenticatedShell({ ...props }: AuthenticatedShellProps) {
  return (
    <AuthenticatedShellView
      {...props}
      abandonSession={abandonSessionRequest}
      deleteSession={deleteSessionRequest}
    />
  )
}

export function AuthenticatedShellView({
  abandonSession,
  activeSessionId,
  children,
  deleteSession,
  header,
  initialIsExpanded,
  onSessionAbandoned,
  preferenceCookieName,
  sessionGroups = [],
  signOut,
  shouldConfirmSessionNavigation = false,
}: AuthenticatedShellViewProps) {
  const t = useTranslations('common.authenticatedShell')
  const translate = useTranslations()
  const activeHref = usePathname()
  const router = useRouter()
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(initialIsExpanded)
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const [isActiveSessionDialogOpen, setIsActiveSessionDialogOpen] = useState(false)
  const [sessionPendingDeletion, setSessionPendingDeletion] = useState<SidebarSessionItem | null>(
    null,
  )
  const [isDeletingSession, setIsDeletingSession] = useState(false)
  const mobileToggleRef = useRef<HTMLButtonElement>(null)
  const mobileCloseRef = useRef<HTMLButtonElement>(null)
  const sessionNavigationTriggerRef = useRef<HTMLAnchorElement>(null)
  const controlLabel = isSidebarExpanded ? t('collapseSidebar') : t('expandSidebar')
  const sidebarLabels = {
    primaryNavigation: t('primaryNavigationLabel'),
    sessions: t('sessionsLabel'),
    signOut: t('signOut'),
  }
  const navigationItems: readonly SidebarNavigationItem[] = AUTHENTICATED_NAVIGATION_ITEMS.map(
    (item) => ({ href: item.href, icon: item.icon, label: t(item.labelKey) }),
  )

  function headingLabel(heading: SessionDayHeading): string {
    if (heading.kind === 'today') return t('today')
    if (heading.kind === 'yesterday') return t('yesterday')

    return heading.value
  }

  const sessionSidebarGroups: readonly SidebarSessionGroup[] = sessionGroups.map((group) => ({
    key: group.localDate,
    heading: headingLabel(group.heading),
    items: group.items.map((item) => ({
      href: item.href,
      label: item.title ?? t('untitledSession'),
      sessionId: item.sessionId,
    })),
  }))

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

  function closeActiveSessionDialog() {
    setIsActiveSessionDialogOpen(false)
    sessionNavigationTriggerRef.current?.focus()
  }

  function openActiveSessionDialog(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault()
    sessionNavigationTriggerRef.current = event.currentTarget
    setIsActiveSessionDialogOpen(true)
    closeMobileSidebar()
  }

  function handlePrimaryNavigation(
    item: { readonly href: string },
    event: MouseEvent<HTMLAnchorElement>,
  ) {
    if (item.href === '/' && activeSessionId !== undefined) openActiveSessionDialog(event)
  }

  function handleSessionNavigation(
    item: { readonly sessionId: string },
    event: MouseEvent<HTMLAnchorElement>,
  ) {
    const shouldProtectNavigation =
      item.sessionId !== activeSessionId && shouldConfirmSessionNavigation

    if (shouldProtectNavigation) openActiveSessionDialog(event)
  }

  function returnToActiveSession() {
    if (activeSessionId === undefined) return

    router.push(sessionPath(activeSessionId))
    setIsActiveSessionDialogOpen(false)
  }

  async function abandonActiveSession() {
    if (activeSessionId === undefined) return

    try {
      await abandonSession(activeSessionId)
    } catch (error: unknown) {
      showApiErrorToast(apiErrorDetails(error), translate)

      return
    }

    onSessionAbandoned?.()
    setIsActiveSessionDialogOpen(false)
    router.push('/')
    // The shell's session list and quota are fetched by the layout, which push alone would reuse.
    router.refresh()
  }

  function renderSessionAction(item: SidebarSessionItem) {
    return (
      <Menu
        actions={[
          {
            icon: 'delete-02',
            isDestructive: true,
            label: t('sessionActions.delete'),
            onSelect: () => setSessionPendingDeletion(item),
          },
        ]}
        triggerIcon="more-vertical"
        triggerLabel={t('sessionActions.label', { session: item.label })}
      />
    )
  }

  async function confirmSessionDeletion() {
    if (sessionPendingDeletion === null) return

    const { href, sessionId } = sessionPendingDeletion

    setIsDeletingSession(true)

    try {
      await deleteSession(sessionId)
    } catch (error: unknown) {
      showApiErrorToast(apiErrorDetails(error), translate)

      return
    } finally {
      setIsDeletingSession(false)
    }

    setSessionPendingDeletion(null)

    if (activeHref === href) router.push('/')
    // The sidebar list is rendered from the layout's fetch, which only a refresh redoes.
    router.refresh()
  }

  return (
    <div className="flex h-dvh bg-surface text-text">
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
              <BrandLink isExpanded label={t('homeLabel')} logoAlt={t('logoAlt')} />

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

          <SidebarBody
            activeHref={activeHref}
            isExpanded={isSidebarExpanded}
            labels={sidebarLabels}
            navigationItems={navigationItems}
            onPrimaryNavigate={handlePrimaryNavigation}
            onSessionNavigate={handleSessionNavigation}
            renderSessionAction={renderSessionAction}
            sessionGroups={sessionSidebarGroups}
            showSessionGroups={isSidebarExpanded}
            signOut={signOut}
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
            rightItem={header}
          />

          <main className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</main>
        </div>
      </div>

      <div aria-hidden={!isMobileSidebarOpen} className="contents" inert={!isMobileSidebarOpen}>
        <button
          aria-label={t('closeNavigation')}
          className={cn(
            'fixed inset-0 z-40 cursor-pointer bg-text/30 backdrop-blur-[1px] transition-opacity duration-200 ease-out motion-reduce:backdrop-filter-none motion-reduce:transition-none md:hidden',
            isMobileSidebarOpen
              ? 'pointer-events-auto opacity-100'
              : 'pointer-events-none opacity-0',
          )}
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
            <BrandLink
              isExpanded
              label={t('homeLabel')}
              logoAlt={t('logoAlt')}
              onClick={closeMobileSidebar}
            />

            <IconButton
              icon="cancel-01"
              label={t('closeNavigation')}
              onClick={closeMobileSidebar}
              ref={mobileCloseRef}
            />
          </SidebarHeader>

          <SidebarBody
            activeHref={activeHref}
            isExpanded
            labels={sidebarLabels}
            navigationItems={navigationItems}
            onPrimaryNavigate={(item, event) => {
              handlePrimaryNavigation(item, event)
              closeMobileSidebar()
            }}
            onSessionNavigate={(item, event) => {
              handleSessionNavigation(item, event)
              closeMobileSidebar()
            }}
            renderSessionAction={renderSessionAction}
            sessionGroups={sessionSidebarGroups}
            showSessionGroups
            signOut={signOut}
          />
        </Sidebar>
      </div>

      <Dialog
        description={t('activeSessionDialog.description')}
        onClose={closeActiveSessionDialog}
        open={isActiveSessionDialogOpen}
        title={t('activeSessionDialog.title')}
      >
        <Button onClick={returnToActiveSession} variant="secondary">
          {t('activeSessionDialog.return')}
        </Button>
        <Button onClick={() => void abandonActiveSession()} variant="destructive">
          {t('activeSessionDialog.abandon')}
        </Button>
      </Dialog>

      <Dialog
        description={t('deleteSessionDialog.description', {
          session: sessionPendingDeletion?.label ?? '',
        })}
        onClose={() => setSessionPendingDeletion(null)}
        open={sessionPendingDeletion !== null}
        title={t('deleteSessionDialog.title')}
      >
        <Button onClick={() => setSessionPendingDeletion(null)} variant="secondary">
          {t('deleteSessionDialog.cancel')}
        </Button>
        <Button
          isLoading={isDeletingSession}
          onClick={() => void confirmSessionDeletion()}
          variant="destructive"
        >
          {t('deleteSessionDialog.confirm')}
        </Button>
      </Dialog>
    </div>
  )
}

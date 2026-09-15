'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useFormatter, useTranslations } from 'next-intl'
import type { MouseEvent, ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'

import { BrandLink } from '@/components/layouts/brand-link'
import { AccountMenu } from '@/components/layouts/account-menu'
import {
  AccountEntry,
  VisitorTopBarAccountEntry,
  type AccountEntryLabels,
} from '@/components/layouts/account-entry'
import {
  AuthenticationDialog,
  type AuthenticationMode,
} from '@/components/auth/authentication-dialog'
import { Header } from '@/components/layouts/header'
import { SettingsDialog } from '@/components/layouts/settings-dialog'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { IconButton } from '@/components/ui/icon-button'
import { Icon } from '@/components/ui/icon'
import { Menu } from '@/components/ui/menu'
import {
  navigationLinkStyles,
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
import { updateAccountName as updateAccountNameRequest } from '@/lib/api/update-account-name'
import { apiErrorDetails } from '@/lib/api/api-error'
import { accountDisplayName } from '@/lib/accounts/account-display-name'
import { showApiErrorToast } from '@/lib/errors/show-api-error-toast'
import type { AccountProfile } from '@/lib/api/contracts/accounts'
import { browserAnalyticsClient, type BrowserAnalyticsClient } from '@/lib/analytics/browser-client'
import type { AuthFormAction } from '@/lib/auth/action-state'
import { cn } from '@/lib/ui/class-names'
import type { Theme } from '@/lib/ui/theme'

type RegisteredAccountProfile = Extract<AccountProfile, { readonly accountKind: 'registered' }>

export type ShellViewer = { readonly accountKind: 'visitor' } | AccountProfile

export interface AuthenticatedShellProps {
  readonly analytics?: BrowserAnalyticsClient | undefined
  readonly activeSessionId?: string | undefined
  readonly isTrialConsumed?: boolean | undefined
  readonly signInAction?: AuthFormAction | undefined
  readonly signUpAction?: AuthFormAction | undefined
  readonly children: ReactNode
  readonly header?: ReactNode | undefined
  readonly initialIsExpanded: boolean
  readonly onThemeChange: (theme: Theme) => void
  readonly preferenceCookieName: string
  readonly sessionGroups?: readonly SessionDayGroup[] | undefined
  readonly onSessionAbandoned?: (() => void) | undefined
  readonly shouldConfirmSessionNavigation?: boolean | undefined
  readonly signOut: SignOutAction
  readonly theme: Theme
  readonly viewer: ShellViewer
}

type AuthenticatedShellViewProps = AuthenticatedShellProps & {
  readonly abandonSession: (sessionId: string) => Promise<void>
  readonly deleteSession: (sessionId: string) => Promise<void>
  readonly updateAccountName: (name: string) => Promise<string>
}

const ONE_YEAR_IN_SECONDS = 31_536_000
const RAIL_SIDEBAR_ID = 'authenticated-sidebar'
const DRAWER_SIDEBAR_ID = 'mobile-authenticated-sidebar'

type SignOutAction = () => void | Promise<void>

interface SidebarLabels {
  readonly account: string
  readonly accountEntry: AccountEntryLabels
  readonly accountDisplayName: string
  readonly accountPlan: string
  readonly accountSettings: string
  readonly primaryNavigation: string
  readonly sessions: string
  readonly signOut: string
}

interface SidebarSettingsEntryProps {
  readonly isExpanded: boolean
  readonly label: string
  readonly onOpenSettings: () => void
}

function SidebarSettingsEntry({ isExpanded, label, onOpenSettings }: SidebarSettingsEntryProps) {
  return (
    <button
      aria-label={isExpanded ? undefined : label}
      className={navigationLinkStyles({ isActive: false })}
      onClick={onOpenSettings}
      type="button"
    >
      <span className="grid size-9 place-items-center">
        <Icon className="text-lg" name="settings-01" />
      </span>
      <span
        aria-hidden={!isExpanded}
        className={cn(
          'min-w-0 whitespace-nowrap text-left text-[0.9375rem] font-normal transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none',
          isExpanded ? 'translate-x-0 opacity-100' : 'pointer-events-none -translate-x-1 opacity-0',
        )}
      >
        {label}
      </span>
    </button>
  )
}

interface SidebarBodyProps {
  readonly accountMenu?: ReactNode | undefined
  readonly activeHref: string | null
  readonly isExpanded: boolean
  readonly labels: SidebarLabels
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
}
function SidebarBody({
  accountMenu,
  activeHref,
  isExpanded,
  labels,
  navigationItems,
  onPrimaryNavigate,
  onSessionNavigate,
  renderSessionAction,
  sessionGroups,
  showSessionGroups,
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
      <div className="mt-auto">{accountMenu}</div>
    </>
  )
}

export function AuthenticatedShell({ ...props }: AuthenticatedShellProps) {
  return (
    <AuthenticatedShellView
      {...props}
      abandonSession={abandonSessionRequest}
      deleteSession={deleteSessionRequest}
      updateAccountName={(name) => updateAccountNameRequest({ name })}
    />
  )
}

export function AuthenticatedShellView({
  abandonSession,
  analytics = browserAnalyticsClient,
  activeSessionId,
  children,
  deleteSession,
  header,
  initialIsExpanded,
  isTrialConsumed = false,
  onSessionAbandoned,
  onThemeChange,
  preferenceCookieName,
  sessionGroups = [],
  signOut,
  signInAction,
  signUpAction,
  theme,
  updateAccountName,
  viewer,
  shouldConfirmSessionNavigation = false,
}: AuthenticatedShellViewProps) {
  const t = useTranslations('common.authenticatedShell')
  const translate = useTranslations()
  const format = useFormatter()
  const activeHref = usePathname()
  const router = useRouter()
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(initialIsExpanded)
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const [isActiveSessionDialogOpen, setIsActiveSessionDialogOpen] = useState(false)
  const [authenticationMode, setAuthenticationMode] = useState<AuthenticationMode | null>(null)
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false)
  const registeredAccount: RegisteredAccountProfile | null =
    viewer.accountKind === 'registered' ? viewer : null
  const [accountName, setAccountName] = useState(registeredAccount?.name ?? null)
  const [sessionPendingDeletion, setSessionPendingDeletion] = useState<SidebarSessionItem | null>(
    null,
  )
  const [isDeletingSession, setIsDeletingSession] = useState(false)
  const mobileToggleRef = useRef<HTMLButtonElement>(null)
  const mobileCloseRef = useRef<HTMLButtonElement>(null)
  const sessionNavigationTriggerRef = useRef<HTMLAnchorElement>(null)
  const controlLabel = isSidebarExpanded ? t('collapseSidebar') : t('expandSidebar')
  const sidebarLabels = {
    account: t('account.label'),
    accountEntry: {
      description: t('accountEntry.description'),
      label: t('accountEntry.label'),
      signIn: t('accountEntry.signIn'),
      signUp: t('accountEntry.signUp'),
      title: t('accountEntry.title'),
    },
    accountDisplayName:
      registeredAccount === null
        ? ''
        : accountDisplayName({ email: registeredAccount.email, name: accountName }),
    accountPlan: t('account.plan'),
    accountSettings: t('account.settings'),
    primaryNavigation: t('primaryNavigationLabel'),
    sessions: t('sessionsLabel'),
    signOut: t('signOut'),
  }
  const headerContent =
    viewer.accountKind === 'visitor' ? (
      <div className="flex items-center gap-3">
        {header === undefined ? null : <div>{header}</div>}
        <VisitorTopBarAccountEntry
          labels={sidebarLabels.accountEntry}
          onSelectAuthentication={setAuthenticationMode}
        />
      </div>
    ) : (
      header
    )
  const navigationItems: readonly SidebarNavigationItem[] = AUTHENTICATED_NAVIGATION_ITEMS.map(
    (item) => ({ href: item.href, icon: item.icon, label: t(item.labelKey) }),
  )

  async function saveAccountName(name: string) {
    try {
      setAccountName(await updateAccountName(name))
    } catch (error: unknown) {
      showApiErrorToast(apiErrorDetails(error), translate)

      return
    }
    router.refresh()
  }

  function headingLabel(heading: SessionDayHeading): string {
    if (heading.kind === 'today') return t('today')
    if (heading.kind === 'yesterday') return t('yesterday')

    return heading.value
  }

  const sessionSidebarGroups: readonly SidebarSessionGroup[] =
    viewer.accountKind === 'registered'
      ? sessionGroups.map((group) => ({
          key: group.localDate,
          heading: headingLabel(group.heading),
          items: group.items.map((item) => ({
            href: item.href,
            label: item.title ?? t('untitledSession'),
            sessionId: item.sessionId,
          })),
        }))
      : []

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

  function formatAccountDateTime(value: string, timeZone: string) {
    return format.dateTime(new Date(value), {
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      month: 'short',
      timeZone,
      year: 'numeric',
    })
  }

  function openSettingsDialog() {
    setIsSettingsDialogOpen(true)
    closeMobileSidebar()
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
    router.refresh()
  }

  function renderAccountMenu(isExpanded: boolean) {
    return registeredAccount === null ? (
      <div className="grid gap-1">
        <SidebarSettingsEntry
          isExpanded={isExpanded}
          label={sidebarLabels.accountSettings}
          onOpenSettings={openSettingsDialog}
        />
        <AccountEntry
          analytics={analytics}
          fromGuest={viewer.accountKind === 'guest'}
          isExpanded={isExpanded}
          labels={sidebarLabels.accountEntry}
          onSelectAuthentication={setAuthenticationMode}
        />
      </div>
    ) : (
      <AccountMenu
        isExpanded={isExpanded}
        name={sidebarLabels.accountDisplayName}
        onOpenSettings={openSettingsDialog}
        plan={sidebarLabels.accountPlan}
        popupLabel={sidebarLabels.account}
        settingsLabel={sidebarLabels.accountSettings}
        signOut={signOut}
        signOutLabel={sidebarLabels.signOut}
      />
    )
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
            accountMenu={renderAccountMenu(isSidebarExpanded)}
            activeHref={activeHref}
            isExpanded={isSidebarExpanded}
            labels={sidebarLabels}
            navigationItems={navigationItems}
            onPrimaryNavigate={handlePrimaryNavigation}
            onSessionNavigate={handleSessionNavigation}
            renderSessionAction={renderSessionAction}
            sessionGroups={sessionSidebarGroups}
            showSessionGroups={isSidebarExpanded}
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
            rightItem={headerContent}
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
            accountMenu={renderAccountMenu(true)}
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
          />
        </Sidebar>
      </div>

      <SettingsDialog
        accountLabels={{
          authenticationMethod: t('settingsDialog.accountDetails.authenticationMethod'),
          authenticationMethodGoogle: t(
            'settingsDialog.accountDetails.authenticationMethods.google',
          ),
          authenticationMethodPassword: t(
            'settingsDialog.accountDetails.authenticationMethods.password',
          ),
          consent: t('settingsDialog.accountDetails.consent.label'),
          consentAccepted: t('settingsDialog.accountDetails.consent.accepted'),
          consentAcceptedAt: t('settingsDialog.accountDetails.consent.acceptedAt'),
          consentNotRecorded: t('settingsDialog.accountDetails.consent.notRecorded'),
          consentPurpose: t('settingsDialog.accountDetails.consent.purpose'),
          consentPurposeVoice: t('settingsDialog.accountDetails.consent.purposeVoice'),
          consentVersion: t('settingsDialog.accountDetails.consent.version'),
          createdAt: t('settingsDialog.accountDetails.createdAt'),
          email: t('settingsDialog.accountDetails.email'),
          plan: t('settingsDialog.accountDetails.plan'),
          planFree: t('settingsDialog.accountDetails.plans.free'),
          timeZone: t('settingsDialog.accountDetails.timeZone'),
        }}
        accountLabel={t('settingsDialog.account')}
        accountProfile={
          registeredAccount === null ? undefined : { ...registeredAccount, name: accountName }
        }
        closeLabel={t('settingsDialog.close')}
        generalLabel={t('settingsDialog.general')}
        formatDateTime={formatAccountDateTime}
        onClose={() => setIsSettingsDialogOpen(false)}
        onSaveName={saveAccountName}
        onThemeChange={onThemeChange}
        open={isSettingsDialogOpen}
        privacyLabel={translate('auth.legal.privacy.label')}
        profileLabel={t('settingsDialog.profile.label')}
        profileLabels={{
          name: t('settingsDialog.profile.name'),
          nameDescription: t('settingsDialog.profile.nameDescription'),
          namePlaceholder: t('settingsDialog.profile.namePlaceholder'),
          save: t('settingsDialog.profile.save'),
        }}
        theme={theme}
        themeLabel={t('settingsDialog.theme.label')}
        themeOptions={{
          dark: t('settingsDialog.theme.dark'),
          light: t('settingsDialog.theme.light'),
        }}
        termsLabel={translate('auth.legal.terms.label')}
        title={t('settingsDialog.title')}
        updatedAtLabel={translate('auth.legal.updatedAt')}
      />

      {registeredAccount !== null ? null : (
        <AuthenticationDialog
          canContinueWithoutAccount={!isTrialConsumed}
          mode={authenticationMode}
          onClose={() => setAuthenticationMode(null)}
          onModeChange={setAuthenticationMode}
          signInAction={signInAction}
          signUpAction={signUpAction}
        />
      )}

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

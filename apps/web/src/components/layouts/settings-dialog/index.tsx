'use client'

import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type PointerEvent,
  type ReactNode,
} from 'react'

import { PrivacyPolicyContent, TermsOfUseContent } from '@/components/auth/legal-content'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Icon } from '@/components/ui/icon'
import { IconButton } from '@/components/ui/icon-button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/ui/class-names'
import { ACCOUNT_NAME_MAX_LENGTH, type AccountProfile } from '@/lib/api/contracts/accounts'
import type { Theme } from '@/lib/ui/theme'

type SettingsSection = 'account' | 'general' | 'privacy' | 'profile' | 'terms'

interface ThemeOptions {
  readonly dark: string
  readonly light: string
}

interface AccountLabels {
  readonly authenticationMethod: string
  readonly authenticationMethodGoogle: string
  readonly authenticationMethodPassword: string
  readonly consent: string
  readonly consentAccepted: string
  readonly consentAcceptedAt: string
  readonly consentNotRecorded: string
  readonly consentPurpose: string
  readonly consentPurposeVoice: string
  readonly consentVersion: string
  readonly createdAt: string
  readonly email: string
  readonly plan: string
  readonly planFree: string
  readonly timeZone: string
}

interface ProfileLabels {
  readonly name: string
  readonly nameDescription: string
  readonly namePlaceholder: string
  readonly save: string
}

interface AccountDetailProps {
  readonly children: ReactNode
  readonly label: string
  readonly valueClassName?: string | undefined
}

function AccountDetail({ children, label, valueClassName }: AccountDetailProps) {
  return (
    <div className="grid gap-1 py-3.5 sm:grid-cols-[minmax(9rem,0.7fr)_minmax(0,1fr)] sm:items-center sm:gap-4">
      <dt className="text-xs font-medium tracking-wide text-text-muted sm:text-sm sm:tracking-normal">
        {label}
      </dt>
      <dd className={cn('min-w-0 text-sm leading-6 text-text', valueClassName)}>{children}</dd>
    </div>
  )
}

interface SettingsDialogProps {
  readonly accountLabels: AccountLabels
  readonly accountLabel: string
  readonly accountProfile: AccountProfile
  readonly closeLabel: string
  readonly generalLabel: string
  readonly formatDateTime: (value: string, timeZone: string) => string
  readonly onClose: () => void
  readonly onSaveName: (name: string) => Promise<void>
  readonly onThemeChange: (theme: Theme) => void
  readonly open: boolean
  readonly privacyLabel: string
  readonly profileLabel: string
  readonly profileLabels: ProfileLabels
  readonly theme: Theme
  readonly themeLabel: string
  readonly themeOptions: ThemeOptions
  readonly termsLabel: string
  readonly title: string
  readonly updatedAtLabel: string
}

export function SettingsDialog({
  accountLabels,
  accountLabel,
  accountProfile,
  closeLabel,
  formatDateTime,
  generalLabel,
  onClose,
  onSaveName,
  onThemeChange,
  open,
  privacyLabel,
  profileLabel,
  profileLabels,
  theme,
  themeLabel,
  themeOptions,
  termsLabel,
  title,
  updatedAtLabel,
}: SettingsDialogProps) {
  const [activeSection, setActiveSection] = useState<SettingsSection>('general')
  const [name, setName] = useState(accountProfile.name ?? '')
  const [isSavingName, setIsSavingName] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const generalPanelId = useId()
  const accountPanelId = useId()
  const profilePanelId = useId()
  const privacyPanelId = useId()
  const termsPanelId = useId()
  const trimmedName = name.trim()
  const canSaveName = trimmedName.length > 0 && trimmedName !== (accountProfile.name ?? '')
  const authenticationMethodLabel =
    accountProfile.authenticationMethod === 'google'
      ? accountLabels.authenticationMethodGoogle
      : accountLabels.authenticationMethodPassword

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog === null) return

    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  async function saveName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setIsSavingName(true)

    try {
      await onSaveName(trimmedName)
    } finally {
      setIsSavingName(false)
    }
  }

  function closeFromBackdrop(event: PointerEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget) onClose()
  }

  function navigationItemClassName(isActive: boolean) {
    return cn(
      'flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-xl px-3 text-sm text-text transition-colors hover:bg-input focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text md:w-full',
      isActive && 'bg-input',
    )
  }

  return (
    <dialog
      aria-labelledby={titleId}
      className="m-auto h-[min(42rem,calc(100dvh-1rem))] w-[calc(100%-1rem)] max-w-3xl overflow-hidden rounded-2xl border border-divider bg-surface p-0 text-text shadow-xl backdrop:bg-black/30 backdrop:backdrop-blur-[1px] dark:backdrop:bg-black/60 md:h-[min(38rem,calc(100dvh-3rem))] md:w-[calc(100%-3rem)]"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onPointerDown={closeFromBackdrop}
      ref={dialogRef}
    >
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-divider px-4 md:absolute md:top-3 md:left-3 md:z-10 md:h-10 md:border-0 md:p-0">
        <h2 className="text-lg font-medium md:sr-only" id={titleId}>
          {title}
        </h2>
        <IconButton icon="cancel-01" label={closeLabel} onClick={onClose} size="sm" />
      </header>

      <div className="flex h-[calc(100%-3.5rem)] min-h-0 flex-col md:grid md:h-full md:grid-cols-[14rem_minmax(0,1fr)]">
        <aside className="shrink-0 border-b border-divider p-2 md:min-h-0 md:border-r md:border-b-0 md:p-3">
          <nav
            aria-label={title}
            className="flex gap-1 overflow-x-auto pt-1 [scrollbar-width:thin] md:mt-12 md:flex-col md:overflow-x-visible md:pt-0"
          >
            <button
              aria-controls={generalPanelId}
              aria-current={activeSection === 'general' ? 'page' : undefined}
              className={navigationItemClassName(activeSection === 'general')}
              onClick={() => setActiveSection('general')}
              type="button"
            >
              <Icon className="text-lg" name="settings-01" />
              {generalLabel}
            </button>

            <button
              aria-controls={accountPanelId}
              aria-current={activeSection === 'account' ? 'page' : undefined}
              className={navigationItemClassName(activeSection === 'account')}
              onClick={() => setActiveSection('account')}
              type="button"
            >
              <Icon className="text-lg" name="user-01" />
              {accountLabel}
            </button>

            <button
              aria-controls={profilePanelId}
              aria-current={activeSection === 'profile' ? 'page' : undefined}
              className={navigationItemClassName(activeSection === 'profile')}
              onClick={() => setActiveSection('profile')}
              type="button"
            >
              <Icon className="text-lg" name="user-circle" />
              {profileLabel}
            </button>

            <button
              aria-controls={privacyPanelId}
              aria-current={activeSection === 'privacy' ? 'page' : undefined}
              className={navigationItemClassName(activeSection === 'privacy')}
              onClick={() => setActiveSection('privacy')}
              type="button"
            >
              <Icon className="text-lg" name="view" />
              {privacyLabel}
            </button>

            <button
              aria-controls={termsPanelId}
              aria-current={activeSection === 'terms' ? 'page' : undefined}
              className={navigationItemClassName(activeSection === 'terms')}
              onClick={() => setActiveSection('terms')}
              type="button"
            >
              <Icon className="text-lg" name="checkmark-circle-02" />
              {termsLabel}
            </button>
          </nav>
        </aside>

        {activeSection === 'general' ? (
          <section
            aria-label={generalLabel}
            className="min-h-0 overflow-y-auto bg-surface px-4 py-5 md:px-6"
            id={generalPanelId}
          >
            <h3 className="text-lg font-medium">{generalLabel}</h3>

            <div className="mt-4 flex min-h-15 items-center justify-between gap-4 border-y border-divider">
              <label className="text-sm" htmlFor={`${generalPanelId}-theme`}>
                {themeLabel}
              </label>

              <span className="relative shrink-0">
                <select
                  className="cursor-pointer appearance-none rounded-xl bg-transparent py-2 pr-8 pl-3 text-right text-sm text-text outline-none transition-colors hover:bg-input focus-visible:ring-2 focus-visible:ring-text"
                  id={`${generalPanelId}-theme`}
                  onChange={(event) => {
                    const selectedTheme = event.currentTarget.value

                    if (selectedTheme === 'light' || selectedTheme === 'dark') {
                      onThemeChange(selectedTheme)
                    }
                  }}
                  value={theme}
                >
                  <option value="light">{themeOptions.light}</option>
                  <option value="dark">{themeOptions.dark}</option>
                </select>
                <svg
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 right-2 size-4 -translate-y-1/2 text-text-muted"
                  fill="none"
                  viewBox="0 0 16 16"
                >
                  <path
                    d="m4 6 4 4 4-4"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.5"
                  />
                </svg>
              </span>
            </div>
          </section>
        ) : null}

        {activeSection === 'account' ? (
          <section
            aria-label={accountLabel}
            className="min-h-0 overflow-y-auto bg-surface px-4 py-5 md:px-6"
            id={accountPanelId}
          >
            <h3 className="text-lg font-medium">{accountLabel}</h3>

            <dl className="mt-4 divide-y divide-divider border-y border-divider">
              <AccountDetail label={accountLabels.email} valueClassName="break-all">
                {accountProfile.email}
              </AccountDetail>
              <AccountDetail label={accountLabels.plan}>{accountLabels.planFree}</AccountDetail>
              <AccountDetail label={accountLabels.timeZone}>
                {accountProfile.timeZone}
              </AccountDetail>
              <AccountDetail label={accountLabels.authenticationMethod}>
                {authenticationMethodLabel}
              </AccountDetail>
              <AccountDetail label={accountLabels.createdAt}>
                {formatDateTime(accountProfile.createdAt, accountProfile.timeZone)}
              </AccountDetail>
            </dl>

            <h4 className="mt-6 text-sm font-medium">{accountLabels.consent}</h4>
            <dl className="mt-2 divide-y divide-divider border-y border-divider">
              <AccountDetail label={accountLabels.consent}>
                {accountProfile.consent === null
                  ? accountLabels.consentNotRecorded
                  : accountLabels.consentAccepted}
              </AccountDetail>
              {accountProfile.consent === null ? null : (
                <>
                  <AccountDetail label={accountLabels.consentPurpose}>
                    {accountLabels.consentPurposeVoice}
                  </AccountDetail>
                  <AccountDetail label={accountLabels.consentVersion}>
                    {accountProfile.consent.version}
                  </AccountDetail>
                  <AccountDetail label={accountLabels.consentAcceptedAt}>
                    {formatDateTime(accountProfile.consent.acceptedAt, accountProfile.timeZone)}
                  </AccountDetail>
                </>
              )}
            </dl>
          </section>
        ) : null}

        {activeSection === 'profile' ? (
          <section
            aria-label={profileLabel}
            className="min-h-0 overflow-y-auto bg-surface px-4 py-5 md:px-6"
            id={profilePanelId}
          >
            <h3 className="text-lg font-medium">{profileLabel}</h3>

            <form className="mt-4 grid gap-4" onSubmit={(event) => void saveName(event)}>
              <Field description={profileLabels.nameDescription} label={profileLabels.name}>
                <Input
                  autoComplete="name"
                  maxLength={ACCOUNT_NAME_MAX_LENGTH}
                  onChange={(event) => setName(event.currentTarget.value)}
                  placeholder={profileLabels.namePlaceholder}
                  value={name}
                />
              </Field>

              <span className="justify-self-start">
                <Button disabled={!canSaveName} isLoading={isSavingName} type="submit">
                  {profileLabels.save}
                </Button>
              </span>
            </form>
          </section>
        ) : null}

        {activeSection === 'privacy' ? (
          <section
            aria-label={privacyLabel}
            className="min-h-0 overflow-y-auto bg-surface px-4 py-5 md:px-6"
            id={privacyPanelId}
          >
            <header className="mb-6 grid gap-1 border-b border-divider pb-4">
              <h3 className="text-lg font-medium">{privacyLabel}</h3>
              <p className="text-xs text-text-muted">{updatedAtLabel}</p>
            </header>
            <div className="grid gap-7">
              <PrivacyPolicyContent />
            </div>
          </section>
        ) : null}

        {activeSection === 'terms' ? (
          <section
            aria-label={termsLabel}
            className="min-h-0 overflow-y-auto bg-surface px-4 py-5 md:px-6"
            id={termsPanelId}
          >
            <header className="mb-6 grid gap-1 border-b border-divider pb-4">
              <h3 className="text-lg font-medium">{termsLabel}</h3>
              <p className="text-xs text-text-muted">{updatedAtLabel}</p>
            </header>
            <div className="grid gap-7">
              <TermsOfUseContent />
            </div>
          </section>
        ) : null}
      </div>
    </dialog>
  )
}

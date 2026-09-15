'use client'

import { useSyncExternalStore } from 'react'

import type { AuthenticationMode } from '@/components/auth/authentication-dialog'
import { Icon } from '@/components/ui/icon'
import type { BrowserAnalyticsClient } from '@/lib/analytics/browser-client'

export interface AccountEntryLabels {
  readonly description: string
  readonly label: string
  readonly signIn: string
  readonly signUp: string
  readonly title: string
}

function subscribeToHydration(): () => void {
  return () => undefined
}

interface AccountEntryProps {
  readonly analytics: BrowserAnalyticsClient
  readonly fromGuest: boolean
  readonly isExpanded: boolean
  readonly labels: AccountEntryLabels
  readonly onSelectAuthentication: (mode: AuthenticationMode) => void
}

export function AccountEntry({
  analytics,
  fromGuest,
  isExpanded,
  labels,
  onSelectAuthentication,
}: AccountEntryProps) {
  function trackGuestEntry(
    event: 'guest_account_sign_in_started' | 'guest_account_sign_up_started',
  ) {
    if (fromGuest) analytics.capture(event)
  }

  if (!isExpanded) {
    if (!fromGuest) {
      return (
        <nav aria-label={labels.label} className="relative z-10">
          <button
            aria-label={labels.signIn}
            className="grid size-10 place-items-center rounded-full border border-border text-text transition-[border-color,background-color,transform] hover:-translate-y-px hover:border-text-muted hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text"
            onClick={() => onSelectAuthentication('sign-in')}
            type="button"
          >
            <Icon className="text-lg" name="arrow-right-01" />
          </button>
        </nav>
      )
    }

    return (
      <nav aria-label={labels.label} className="relative z-10 grid gap-1">
        <button
          aria-label={labels.signUp}
          className="grid size-10 place-items-center rounded-full bg-text text-surface transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text"
          onClick={() => {
            trackGuestEntry('guest_account_sign_up_started')
            onSelectAuthentication('sign-up')
          }}
          type="button"
        >
          <Icon className="text-lg" name="user-circle" />
        </button>
        <button
          aria-label={labels.signIn}
          className="grid size-10 place-items-center rounded-full border border-border text-text transition-[border-color,background-color,transform] hover:-translate-y-px hover:border-text-muted hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text"
          onClick={() => {
            trackGuestEntry('guest_account_sign_in_started')
            onSelectAuthentication('sign-in')
          }}
          type="button"
        >
          <Icon className="text-lg" name="arrow-right-01" />
        </button>
      </nav>
    )
  }

  if (!fromGuest) {
    return (
      <nav
        aria-label={labels.label}
        className="relative z-10 -mx-3 border-t border-divider px-3 pt-5"
      >
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <h2 className="text-sm font-medium tracking-[-0.02em] text-text">{labels.title}</h2>
            <p className="text-sm leading-6 text-text-muted">{labels.description}</p>
          </div>
          <button
            className="inline-flex min-h-12 items-center justify-center rounded-full border border-border px-4 text-sm font-medium text-text transition-[border-color,background-color,transform] hover:-translate-y-px hover:border-text-muted hover:bg-surface-raised hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text"
            onClick={() => onSelectAuthentication('sign-in')}
            type="button"
          >
            {labels.signIn}
          </button>
        </div>
      </nav>
    )
  }

  return (
    <nav
      aria-label={labels.label}
      className="relative z-10 grid gap-2 border-t border-divider pt-3"
    >
      <button
        className="inline-flex min-h-10 items-center justify-center rounded-full bg-text px-4 text-sm font-medium text-surface transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text"
        onClick={() => {
          trackGuestEntry('guest_account_sign_up_started')
          onSelectAuthentication('sign-up')
        }}
        type="button"
      >
        {labels.signUp}
      </button>
      <button
        className="inline-flex min-h-10 items-center justify-center rounded-full border border-border px-4 text-sm font-medium text-text transition-[border-color,background-color,transform] hover:-translate-y-px hover:border-text-muted hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text"
        onClick={() => {
          trackGuestEntry('guest_account_sign_in_started')
          onSelectAuthentication('sign-in')
        }}
        type="button"
      >
        {labels.signIn}
      </button>
    </nav>
  )
}

interface VisitorTopBarAccountEntryProps {
  readonly labels: AccountEntryLabels
  readonly onSelectAuthentication: (mode: AuthenticationMode) => void
}

export function VisitorTopBarAccountEntry({
  labels,
  onSelectAuthentication,
}: VisitorTopBarAccountEntryProps) {
  const isInteractive = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  )

  return (
    <nav aria-label={labels.label} className="flex items-center gap-2">
      <button
        className="inline-flex min-h-9 items-center justify-center rounded-full bg-text px-4 text-sm font-medium text-surface transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text"
        disabled={!isInteractive}
        onClick={() => onSelectAuthentication('sign-in')}
        type="button"
      >
        {labels.signIn}
      </button>
      <button
        className="inline-flex min-h-9 items-center justify-center rounded-full border border-border px-4 text-sm font-medium text-text transition-[border-color,background-color,transform] hover:-translate-y-px hover:border-text-muted hover:bg-surface-raised hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text"
        disabled={!isInteractive}
        onClick={() => onSelectAuthentication('sign-up')}
        type="button"
      >
        {labels.signUp}
      </button>
    </nav>
  )
}

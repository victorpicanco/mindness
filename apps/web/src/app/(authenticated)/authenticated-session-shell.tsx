'use client'

import posthog from 'posthog-js'
import { useEffect } from 'react'

import {
  AuthenticatedShell,
  AuthenticatedShellView,
  type AuthenticatedShellProps,
} from '@/components/layouts/authenticated-shell'
import { updateAccountName as updateAccountNameRequest } from '@/lib/api/update-account-name'
import {
  PracticeSessionProvider,
  usePracticeSessionStore,
} from '@/stores/practice-session/provider'
import type { PracticeSessionInitialState } from '@/stores/practice-session/store'
import { useTheme } from '@/components/providers/theme-provider'

interface AuthenticatedSessionShellProps extends Omit<
  AuthenticatedShellProps,
  'onThemeChange' | 'theme'
> {
  readonly initialPracticeSessionState?: PracticeSessionInitialState | undefined
}

type AuthenticatedSessionShellViewProps = AuthenticatedSessionShellProps & {
  readonly abandonSession: (sessionId: string) => Promise<void>
  readonly deleteSession: (sessionId: string) => Promise<void>
  readonly updateAccountName?: ((name: string) => Promise<string>) | undefined
}

type SessionNavigationShellProps = Omit<AuthenticatedShellProps, 'onThemeChange' | 'theme'> & {
  readonly abandonSession?: ((sessionId: string) => Promise<void>) | undefined
  readonly deleteSession?: ((sessionId: string) => Promise<void>) | undefined
  readonly updateAccountName?: ((name: string) => Promise<string>) | undefined
}

function SessionNavigationShell({
  abandonSession,
  deleteSession,
  updateAccountName = (name) => updateAccountNameRequest({ name }),
  ...props
}: SessionNavigationShellProps) {
  const status = usePracticeSessionStore((state) => state.status)
  const reset = usePracticeSessionStore((state) => state.reset)
  const { setTheme, theme } = useTheme()
  const shouldConfirmSessionNavigation = status === 'recording' || status === 'uploading'
  const accountEmail = props.accountProfile.email

  useEffect(() => {
    posthog.identify(accountEmail, { email: accountEmail })
  }, [accountEmail])

  const shellProps = {
    ...props,
    onSessionAbandoned: reset,
    onThemeChange: setTheme,
    shouldConfirmSessionNavigation,
    theme,
  }

  return abandonSession === undefined || deleteSession === undefined ? (
    <AuthenticatedShell {...shellProps} />
  ) : (
    <AuthenticatedShellView
      {...shellProps}
      abandonSession={abandonSession}
      deleteSession={deleteSession}
      updateAccountName={updateAccountName}
    />
  )
}

export function AuthenticatedSessionShell({
  initialPracticeSessionState,
  ...props
}: AuthenticatedSessionShellProps) {
  return (
    <PracticeSessionProvider initialState={initialPracticeSessionState}>
      <SessionNavigationShell {...props} />
    </PracticeSessionProvider>
  )
}

export function AuthenticatedSessionShellView({
  abandonSession,
  deleteSession,
  initialPracticeSessionState,
  ...props
}: AuthenticatedSessionShellViewProps) {
  return (
    <PracticeSessionProvider initialState={initialPracticeSessionState}>
      <SessionNavigationShell
        {...props}
        abandonSession={abandonSession}
        deleteSession={deleteSession}
      />
    </PracticeSessionProvider>
  )
}

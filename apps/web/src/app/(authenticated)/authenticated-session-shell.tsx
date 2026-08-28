'use client'

import {
  AuthenticatedShell,
  AuthenticatedShellView,
  type AuthenticatedShellProps,
} from '@/components/layouts/authenticated-shell'
import {
  PracticeSessionProvider,
  usePracticeSessionStore,
} from '@/stores/practice-session/provider'
import type { PracticeSessionInitialState } from '@/stores/practice-session/store'

interface AuthenticatedSessionShellProps extends AuthenticatedShellProps {
  readonly initialPracticeSessionState?: PracticeSessionInitialState | undefined
}

type AuthenticatedSessionShellViewProps = AuthenticatedSessionShellProps & {
  readonly abandonSession: (sessionId: string) => Promise<void>
  readonly deleteSession: (sessionId: string) => Promise<void>
}

type SessionNavigationShellProps = AuthenticatedShellProps & {
  readonly abandonSession?: ((sessionId: string) => Promise<void>) | undefined
  readonly deleteSession?: ((sessionId: string) => Promise<void>) | undefined
}

function SessionNavigationShell({
  abandonSession,
  deleteSession,
  ...props
}: SessionNavigationShellProps) {
  const status = usePracticeSessionStore((state) => state.status)
  const reset = usePracticeSessionStore((state) => state.reset)
  const shouldConfirmSessionNavigation = status === 'recording' || status === 'uploading'

  const shellProps = {
    ...props,
    onSessionAbandoned: reset,
    shouldConfirmSessionNavigation,
  }

  return abandonSession === undefined || deleteSession === undefined ? (
    <AuthenticatedShell {...shellProps} />
  ) : (
    <AuthenticatedShellView
      {...shellProps}
      abandonSession={abandonSession}
      deleteSession={deleteSession}
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

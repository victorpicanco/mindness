'use client'

import {
  AuthenticatedShell,
  type AuthenticatedShellProps,
} from '@/components/layouts/authenticated-shell'
import {
  PracticeSessionProvider,
  usePracticeSessionStore,
} from '@/stores/practice-session/provider'
import type { PracticeSessionInitialState } from '@/stores/practice-session/store'

interface AuthenticatedSessionShellProps extends AuthenticatedShellProps {
  readonly initialPracticeSessionState?: PracticeSessionInitialState
}

function SessionNavigationShell(props: AuthenticatedShellProps) {
  const status = usePracticeSessionStore((state) => state.status)
  const reset = usePracticeSessionStore((state) => state.reset)
  const shouldConfirmSessionNavigation = status === 'recording' || status === 'uploading'

  return (
    <AuthenticatedShell
      {...props}
      onSessionAbandoned={reset}
      shouldConfirmSessionNavigation={shouldConfirmSessionNavigation}
    />
  )
}

export function AuthenticatedSessionShell({
  initialPracticeSessionState,
  ...props
}: AuthenticatedSessionShellProps) {
  return (
    <PracticeSessionProvider
      {...(initialPracticeSessionState === undefined
        ? {}
        : { initialState: initialPracticeSessionState })}
    >
      <SessionNavigationShell {...props} />
    </PracticeSessionProvider>
  )
}

'use client'

import { useRouter } from 'next/navigation'

import { sessionPath } from '@/lib/navigation/session-routes'

import {
  PracticeConfigForm,
  type PracticeCategory,
  type PracticeQuota,
  type SignOutAction,
  type StartSessionRequest,
} from '@/components/practice/config-form'

interface PracticeSessionStartProps {
  readonly categories: readonly PracticeCategory[]
  readonly quota: PracticeQuota | null
  readonly signOut: SignOutAction
  readonly startSession?: StartSessionRequest
}

export function PracticeSessionStart({
  categories,
  quota,
  signOut,
  startSession,
}: PracticeSessionStartProps) {
  const router = useRouter()

  function openSession(sessionId: string) {
    router.push(sessionPath(sessionId))
    router.refresh()
  }

  return (
    <PracticeConfigForm
      categories={categories}
      onSessionStarted={openSession}
      quota={quota}
      signOut={signOut}
      {...(startSession === undefined ? {} : { startSession })}
    />
  )
}

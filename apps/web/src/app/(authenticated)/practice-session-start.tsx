'use client'

import { useRouter } from 'next/navigation'

import {
  PracticeConfigForm,
  type PracticeCategory,
  type PracticeQuota,
  type StartSessionRequest,
} from './practice-config-form'

interface PracticeSessionStartProps {
  readonly categories: readonly PracticeCategory[]
  readonly quota: PracticeQuota | null
  readonly startSession?: StartSessionRequest
}

export function PracticeSessionStart({
  categories,
  quota,
  startSession,
}: PracticeSessionStartProps) {
  const router = useRouter()

  function openSession(sessionId: string) {
    router.push(`/${sessionId}`)
    router.refresh()
  }

  return (
    <PracticeConfigForm
      categories={categories}
      onSessionStarted={openSession}
      quota={quota}
      {...(startSession === undefined ? {} : { startSession })}
    />
  )
}

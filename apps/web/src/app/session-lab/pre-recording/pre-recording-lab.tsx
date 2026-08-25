'use client'

import { useState } from 'react'

import { SessionRecorder } from '@/components/practice/session-recorder'
import type { AudioLevelSource } from '@/components/practice/use-audio-levels'
import { AuthenticatedShell } from '@/components/layouts/authenticated-shell'
import { SessionQuota } from '@/components/layouts/session-quota'

const THEME_TITLE = 'Comunicação clara em conversas difíceis'
const SIDEBAR_COOKIE_NAME = 'mindness-session-lab-sidebar-expanded'
const FAKE_QUOTA = {
  allowance: 4,
  remaining: 3,
  renewsAt: '2026-09-01T12:00:00.000Z',
} as const

export interface PreRecordingLabProps {
  readonly source?: AudioLevelSource
}

export function PreRecordingLab({ source }: PreRecordingLabProps) {
  const [isRecording, setIsRecording] = useState(false)

  return (
    <AuthenticatedShell
      header={<SessionQuota {...FAKE_QUOTA} />}
      initialIsExpanded
      preferenceCookieName={SIDEBAR_COOKIE_NAME}
      sessionItems={[]}
      signOut={() => undefined}
    >
      <div className="flex min-h-0 flex-1 flex-col px-6 pt-6 pb-10">
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <h1 className="font-(family-name:--font-buenard) max-w-2xl text-center text-4xl leading-tight tracking-tight text-balance sm:text-5xl">
            {THEME_TITLE}
          </h1>
        </div>
        <div className="mx-auto w-full max-w-3xl">
          <SessionRecorder
            isRecording={isRecording}
            onLimitReached={() => {
              setIsRecording(false)
            }}
            onToggleRecording={() => {
              setIsRecording((current) => !current)
            }}
            {...(source === undefined ? {} : { source })}
          />
        </div>
      </div>
    </AuthenticatedShell>
  )
}

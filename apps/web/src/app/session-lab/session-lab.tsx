'use client'

import {
  PracticeConfigForm,
  type StartSessionRequest,
} from '@/app/(authenticated)/practice-config-form'
import { RecordingStart } from '@/app/(authenticated)/recording-start'
import { ResearchTimer } from '@/app/(authenticated)/research-timer'
import { AuthenticatedShell } from '@/components/layouts/authenticated-shell'
import { SessionQuota } from '@/components/layouts/session-quota'
import {
  PracticeSessionProvider,
  usePracticeSessionStore,
} from '@/stores/practice-session/provider'
import type { PracticeSessionInitialState } from '@/stores/practice-session/store'
import { useTranslations } from 'next-intl'

const FAKE_CATEGORIES = [
  { categoryId: '7d5f46c9-3cbd-4c6d-84aa-66b8148a91aa', name: 'Foco', slug: 'focus' },
  {
    categoryId: '7d5f46c9-3cbd-4c6d-84aa-66b8148a91ab',
    name: 'Comunicação',
    slug: 'communication',
  },
] as const

const FAKE_QUOTA = {
  allowance: 4,
  remaining: 3,
  renewsAt: '2026-09-01T12:00:00.000Z',
} as const

const FAKE_SESSION_ID = '7d5f46c9-3cbd-4c6d-84aa-66b8148a91ac'

const startFakeSession: StartSessionRequest = () => {
  const now = Date.now()

  return Promise.resolve({
    expiresAt: new Date(now + 5 * 60_000).toISOString(),
    researchEndsAt: new Date(now + 3 * 60_000).toISOString(),
    sessionId: FAKE_SESSION_ID,
    themeTitle: 'Comunicação clara em conversas difíceis',
  })
}

function SessionLabContent() {
  const t = useTranslations('home.practice')
  const status = usePracticeSessionStore((state) => state.status)

  return (
    <AuthenticatedShell
      header={<SessionQuota {...FAKE_QUOTA} />}
      initialIsExpanded
      preferenceCookieName="mindness-session-lab-sidebar-expanded"
      sessionItems={[]}
    >
      <div className="flex min-h-0 flex-1 flex-col bg-surface px-6 py-10">
        <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 items-center justify-between gap-6">
          <div className="flex size-full min-h-0 flex-col items-center justify-center px-6 py-12 sm:px-10">
            {status === 'researching' ? (
              <ResearchTimer />
            ) : status === 'awaiting-recording' ||
              status === 'recording' ||
              status === 'expired' ? (
              <RecordingStart />
            ) : (
              <>
                <h1 className="font-(family-name:--font-buenard) text-center text-3xl leading-tight tracking-tight sm:text-4xl">
                  {t('title')}
                </h1>
                <PracticeConfigForm
                  categories={FAKE_CATEGORIES}
                  onSessionStarted={() => undefined}
                  quota={{ allowance: FAKE_QUOTA.allowance, renewsAt: FAKE_QUOTA.renewsAt }}
                  startSession={startFakeSession}
                />
              </>
            )}
          </div>
        </div>
      </div>
    </AuthenticatedShell>
  )
}

export interface SessionLabProps {
  readonly initialState?: PracticeSessionInitialState
}

export function SessionLab({ initialState }: SessionLabProps) {
  return (
    <PracticeSessionProvider {...(initialState === undefined ? {} : { initialState })}>
      <SessionLabContent />
    </PracticeSessionProvider>
  )
}

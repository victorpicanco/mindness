'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import posthog from 'posthog-js'
import { useEffect, useRef, useState } from 'react'
import type { z } from 'zod'

import { apiErrorDetails } from '@/lib/api/api-error'
import { bffFetch } from '@/lib/api/bff-client'
import { sessionAnalysisAvailabilitySchema } from '@/lib/api/contracts/sessions'
import { usePracticeSessionStore } from '@/stores/practice-session/provider'

import { buttonStyles } from '@/components/ui/button'

import { ProcessingSteps } from '@/components/practice/processing-steps'
import { SessionMessage } from '@/components/practice/session-message'

const DEFAULT_POLL_INTERVAL_MS = 2_000

type TerminalFailureMessage = 'failed' | 'timeout'

const TERMINAL_FAILURE_MESSAGES: Record<string, TerminalFailureMessage> = {
  'analyses.ANALYSIS_FAILED': 'failed',
  'analyses.ANALYSIS_TIMEOUT': 'timeout',
}

type SessionAnalysisAvailability = z.output<typeof sessionAnalysisAvailabilitySchema>

export type FetchSessionAnalysis = (sessionId: string) => Promise<SessionAnalysisAvailability>

function fetchSessionAnalysis(sessionId: string): Promise<SessionAnalysisAvailability> {
  return bffFetch(`/sessions/${sessionId}/analysis`, {
    method: 'GET',
    schema: sessionAnalysisAvailabilitySchema,
  })
}

function terminalFailure(error: unknown): TerminalFailureMessage | null {
  return TERMINAL_FAILURE_MESSAGES[apiErrorDetails(error).code] ?? null
}

type ProcessingStatusProps = {
  readonly holdUntilResponse?: boolean | undefined
}

export function ProcessingStatus({ holdUntilResponse = false }: ProcessingStatusProps) {
  return (
    <ProcessingStatusView
      fetchAnalysis={fetchSessionAnalysis}
      holdUntilResponse={holdUntilResponse}
      pollIntervalMs={DEFAULT_POLL_INTERVAL_MS}
    />
  )
}

type ProcessingStatusViewProps = {
  readonly fetchAnalysis: FetchSessionAnalysis
  readonly holdUntilResponse?: boolean | undefined
  readonly pollIntervalMs: number
}

export function ProcessingStatusView({
  fetchAnalysis,
  holdUntilResponse = false,
  pollIntervalMs,
}: ProcessingStatusViewProps) {
  const [failure, setFailure] = useState<TerminalFailureMessage | null>(null)
  const session = usePracticeSessionStore((state) => state.session)
  const status = usePracticeSessionStore((state) => state.status)

  const waiting =
    status === 'uploading' || status === 'processing' || (status === 'done' && holdUntilResponse)

  if (failure !== null) return <ProcessingFailure message={failure} />
  if (!waiting || session === null) return null
  return (
    <>
      <ProcessingSteps paused={status === 'uploading'} />
      {status === 'processing' ? (
        <AnalysisPoll
          fetchAnalysis={fetchAnalysis}
          onTerminalFailure={setFailure}
          pollIntervalMs={pollIntervalMs}
          sessionId={session.sessionId}
        />
      ) : null}
    </>
  )
}

function ProcessingFailure({ message }: { readonly message: TerminalFailureMessage }) {
  const t = useTranslations('home.processing')
  const conversationT = useTranslations('home.conversation')

  return (
    <div className="pt-6">
      <SessionMessage label={conversationT('assistantMessageLabel')} sender="assistant">
        <section className="flex max-w-md flex-col items-start gap-4">
          <p role="alert">{t(message)}</p>
          <Link className={buttonStyles()} href="/">
            {t('newSessionLink')}
          </Link>
        </section>
      </SessionMessage>
    </div>
  )
}

interface AnalysisPollProps {
  readonly fetchAnalysis: FetchSessionAnalysis
  readonly onTerminalFailure: (failure: TerminalFailureMessage) => void
  readonly pollIntervalMs: number
  readonly sessionId: string
}

function AnalysisPoll({
  fetchAnalysis,
  onTerminalFailure,
  pollIntervalMs,
  sessionId,
}: AnalysisPollProps) {
  const router = useRouter()
  const completeAnalysis = usePracticeSessionStore((state) => state.completeAnalysis)
  const reset = usePracticeSessionStore((state) => state.reset)
  const settledRef = useRef(false)
  const query = useQuery({
    queryFn: () => fetchAnalysis(sessionId),
    queryKey: ['session-analysis', sessionId],
    refetchInterval: (currentQuery) =>
      currentQuery.state.data !== undefined || terminalFailure(currentQuery.state.error) !== null
        ? false
        : pollIntervalMs,
    retry: false,
  })

  useEffect(() => {
    if (settledRef.current) return

    const failure = terminalFailure(query.error)
    if (failure !== null) {
      settledRef.current = true
      posthog.capture('analysis_failed', { session_id: sessionId, reason: failure })
      reset()
      onTerminalFailure(failure)
      return
    }

    if (query.data === undefined) return

    settledRef.current = true
    posthog.capture('analysis_ready', { session_id: sessionId })
    completeAnalysis()
    router.refresh()
  }, [completeAnalysis, onTerminalFailure, query.data, query.error, reset, router, sessionId])

  return null
}

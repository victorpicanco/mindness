'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'
import type { z } from 'zod'

import { apiErrorDetails } from '@/lib/api/api-error'
import { bffFetch } from '@/lib/api/bff-client'
import { sessionAnalysisAvailabilitySchema } from '@/lib/api/contracts/sessions'
import { usePracticeSessionStore } from '@/stores/practice-session/provider'

import { buttonStyles } from '@/components/ui/button'
import { ShinyText } from '@/components/ui/shiny-text'

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

  if (failure !== null) return <ProcessingFailure message={failure} />
  if (status === 'done' && holdUntilResponse) return <AnalysisWaiting />
  if (status !== 'processing' || session === null) return null

  return (
    <AnalysisPoll
      fetchAnalysis={fetchAnalysis}
      onTerminalFailure={setFailure}
      pollIntervalMs={pollIntervalMs}
      sessionId={session.sessionId}
    />
  )
}

function AnalysisWaiting() {
  const t = useTranslations('home.processing')

  return (
    <p className="text-xs" role="status">
      <ShinyText text={t('waiting')} />
    </p>
  )
}

function ProcessingFailure({ message }: { readonly message: TerminalFailureMessage }) {
  const t = useTranslations('home.processing')
  const conversationT = useTranslations('home.conversation')

  return (
    <SessionMessage label={conversationT('assistantMessageLabel')} sender="assistant">
      <section className="flex max-w-md flex-col items-start gap-4">
        <p role="alert">{t(message)}</p>
        <Link className={buttonStyles()} href="/">
          {t('newSessionLink')}
        </Link>
      </section>
    </SessionMessage>
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
      reset()
      onTerminalFailure(failure)
      return
    }

    if (query.data === undefined) return

    settledRef.current = true
    completeAnalysis()
    router.refresh()
  }, [completeAnalysis, onTerminalFailure, query.data, query.error, reset, router])

  return <AnalysisWaiting />
}

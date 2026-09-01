import type { PrismaClient } from '@/generated/prisma/client.js'
import type {
  AccountsPort,
  AccountPlan,
} from '@/modules/analyses/domain/ports/accounts-port/index.js'
import type {
  AnalysisFailure,
  SessionsPort,
  SessionProcessingContext,
} from '@/modules/analyses/domain/ports/sessions-port/index.js'
import type { ThemesPort } from '@/modules/analyses/domain/ports/themes-port/index.js'
import type { AuditoryAnalysisResult } from '@/modules/analyses/domain/ports/auditory-analysis-port/index.js'
import type { FeedbackSynthesisResult } from '@/modules/analyses/domain/ports/feedback-synthesis-port/index.js'
import { CommunicationFeedback } from '@/modules/analyses/domain/value-objects/communication-feedback/index.js'
import { InMemoryAudioPreparationAdapter } from '@/modules/analyses/infrastructure/adapters/in-memory-audio-preparation-adapter/index.js'
import { InMemoryAuditoryAnalysisAdapter } from '@/modules/analyses/infrastructure/adapters/in-memory-auditory-analysis-adapter/index.js'
import { InMemoryAudioReaderAdapter } from '@/modules/analyses/infrastructure/adapters/in-memory-audio-reader-adapter/index.js'
import { InMemoryFeedbackSynthesisAdapter } from '@/modules/analyses/infrastructure/adapters/in-memory-feedback-synthesis-adapter/index.js'
import { InMemoryEvaluationAdapter } from '@/modules/analyses/infrastructure/adapters/in-memory-evaluation-adapter/index.js'
import { InMemoryProcessingQueueAdapter } from '@/modules/analyses/infrastructure/adapters/in-memory-processing-queue-adapter/index.js'
import { InMemoryTranscriptionAdapter } from '@/modules/analyses/infrastructure/adapters/in-memory-transcription-adapter/index.js'

const ANALYSES_TABLES = [
  'analyses',
  'communication_analyses',
  'transcriptions',
  'analysis_cost_entries',
]

export interface FakeAccountsPort extends AccountsPort {
  setPlan(accountId: string, plan: AccountPlan): void
  registerIdentity(accessToken: string, accountId: string): void
  reset(): void
}

export function createFakeAccountsPort(): FakeAccountsPort {
  const plans = new Map<string, AccountPlan>()
  const identities = new Map<string, string>()
  return {
    findPlan: (accountId) => Promise.resolve(plans.get(accountId) ?? null),
    resolveAccountId: (accessToken) => Promise.resolve(identities.get(accessToken) ?? null),
    setPlan: (accountId, plan) => plans.set(accountId, plan),
    registerIdentity: (accessToken, accountId) => identities.set(accessToken, accountId),
    reset: () => {
      plans.clear()
      identities.clear()
    },
  }
}

export interface FakeSessionsPort extends SessionsPort {
  setAnalysisFailure(sessionId: string, failure: AnalysisFailure): void
  setContext(context: SessionProcessingContext): void
  setReadable(sessionId: string, accountId: string): void
  reset(): void
}

export function createFakeSessionsPort(): FakeSessionsPort {
  const contexts = new Map<string, SessionProcessingContext>()
  const failures = new Map<string, AnalysisFailure>()
  const readableBySessionAndAccount = new Set<string>()
  return {
    findProcessingContext: (sessionId) => Promise.resolve(contexts.get(sessionId) ?? null),
    listStuckProcessing: (before, limit) =>
      Promise.resolve(
        [...contexts.values()]
          .filter((context) => context.recordedAt.getTime() <= before.getTime())
          .slice(0, limit)
          .map((context) => context.sessionId),
      ),
    checkAnalysisAccess: (sessionId, accountId) =>
      Promise.resolve({
        readable: readableBySessionAndAccount.has(`${sessionId}:${accountId}`),
        failure: failures.get(sessionId) ?? null,
      }),
    setContext: (context) => contexts.set(context.sessionId, context),
    setAnalysisFailure: (sessionId, failure) => failures.set(sessionId, failure),
    setReadable: (sessionId, accountId) =>
      readableBySessionAndAccount.add(`${sessionId}:${accountId}`),
    reset: () => {
      contexts.clear()
      failures.clear()
      readableBySessionAndAccount.clear()
    },
  }
}

export interface FakeThemesPort extends ThemesPort {
  setTitle(themeId: string, title: string): void
  reset(): void
}

export function createFakeThemesPort(): FakeThemesPort {
  const titles = new Map<string, string>()
  return {
    findTitle: (themeId) => Promise.resolve(titles.get(themeId) ?? null),
    setTitle: (themeId, title) => titles.set(themeId, title),
    reset: () => titles.clear(),
  }
}

export function createIntegrationAuditoryResult(): AuditoryAnalysisResult {
  return {
    observation: {
      audioUsability: 'usable',
      limitations: [],
      literalTranscript: 'Transcript',
      mainMessage: 'The speaker defends the main idea.',
      attemptedStructure: 'Opening, argument and closing.',
      deliverySummary: 'Steady delivery with occasional prolongations.',
      candidateEvents: [],
    },
    inputTokens: 1,
    outputTokens: 1,
  }
}

export function createIntegrationSynthesisResult(): FeedbackSynthesisResult {
  return {
    feedback: CommunicationFeedback.create({
      durationSeconds: 30,
      audioUsability: 'usable',
      alignmentQuality: 'reliable',
      limitations: [],
      literalTranscript: 'Transcript',
      mainMessage: 'The speaker defends the main idea.',
      attemptedStructure: 'Opening, argument and closing.',
      summary: 'The message arrives complete. The delivery stays steady.',
      strengths: [],
      moments: [],
      patterns: [],
      asrDivergences: [],
      priorities: [],
    }),
    inputTokens: 1,
    outputTokens: 1,
  }
}

export function clearAnalysesData(prisma: PrismaClient): Promise<number> {
  return prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${ANALYSES_TABLES.join(', ')} RESTART IDENTITY CASCADE`,
  )
}

export {
  InMemoryAudioPreparationAdapter,
  InMemoryAudioReaderAdapter,
  InMemoryAuditoryAnalysisAdapter,
  InMemoryEvaluationAdapter,
  InMemoryFeedbackSynthesisAdapter,
  InMemoryProcessingQueueAdapter,
  InMemoryTranscriptionAdapter,
}

export {
  assertResponseMatchesSchema,
  type InjectedResponse,
} from '@/shared/http/openapi-response-assertion/index.js'

import type { PrismaClient } from '@/generated/prisma/client.js'
import type {
  AccountsPort,
  AccountPlan,
} from '@/modules/analyses/domain/ports/accounts-port/index.js'
import type {
  SessionsPort,
  SessionProcessingContext,
} from '@/modules/analyses/domain/ports/sessions-port/index.js'
import type { ThemesPort } from '@/modules/analyses/domain/ports/themes-port/index.js'
import { InMemoryAudioReaderAdapter } from '@/modules/analyses/infrastructure/adapters/in-memory-audio-reader-adapter/index.js'
import { InMemoryEvaluationAdapter } from '@/modules/analyses/infrastructure/adapters/in-memory-evaluation-adapter/index.js'
import { InMemoryProcessingQueueAdapter } from '@/modules/analyses/infrastructure/adapters/in-memory-processing-queue-adapter/index.js'
import { InMemoryTranscriptionAdapter } from '@/modules/analyses/infrastructure/adapters/in-memory-transcription-adapter/index.js'

const ANALYSES_TABLES = ['analyses', 'transcriptions', 'analysis_cost_entries']

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
  setContext(context: SessionProcessingContext): void
  setReadable(sessionId: string, accountId: string): void
  reset(): void
}

export function createFakeSessionsPort(): FakeSessionsPort {
  const contexts = new Map<string, SessionProcessingContext>()
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
    isReadableByAccount: (sessionId, accountId) =>
      Promise.resolve(readableBySessionAndAccount.has(`${sessionId}:${accountId}`)),
    setContext: (context) => contexts.set(context.sessionId, context),
    setReadable: (sessionId, accountId) =>
      readableBySessionAndAccount.add(`${sessionId}:${accountId}`),
    reset: () => {
      contexts.clear()
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

export function clearAnalysesData(prisma: PrismaClient): Promise<number> {
  return prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${ANALYSES_TABLES.join(', ')} RESTART IDENTITY CASCADE`,
  )
}

export {
  InMemoryAudioReaderAdapter,
  InMemoryEvaluationAdapter,
  InMemoryProcessingQueueAdapter,
  InMemoryTranscriptionAdapter,
}

export {
  assertResponseMatchesSchema,
  type InjectedResponse,
} from '@/shared/http/openapi-response-assertion/index.js'

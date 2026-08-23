import { describe, expect, it } from 'vitest'

import { BaseError } from '@/shared/errors/base-error/index.js'
import { DatabaseError } from '@/shared/errors/database-error/index.js'
import { buildApp } from '@/shared/http/build-app/index.js'
import { createLogger } from '@/shared/logger/pino-logger/index.js'
import type {
  AnalysesPrismaClient,
  AnalysesPrismaTransactionRunner,
} from '@/modules/analyses/infrastructure/clients/analyses-prisma-client/index.js'
import type {
  SessionRow,
  SessionsPrismaClient,
  SessionsPrismaTransactionRunner,
} from '@/modules/sessions/infrastructure/clients/sessions-prisma-client/index.js'

import {
  closeAnalysisWorker,
  createAnalysisWorker,
  registerAnalysisPipelineModules,
  registerExpiredSessionSweep,
  registerOrphanAnalysisReconciliationSweep,
  ORPHAN_ANALYSIS_RECONCILIATION_INTERVAL_MS,
  ORPHAN_ANALYSIS_RECONCILIATION_LIMIT,
  ORPHAN_ANALYSIS_STALE_AFTER_MS,
  SWEEP_INTERVAL_MS,
} from './worker.js'

class FakeAnalysisDeadlineExceededError extends BaseError {
  readonly code = 'analyses.ANALYSIS_DEADLINE_EXCEEDED'
  readonly httpStatus = 422
}

describe('registerExpiredSessionSweep', () => {
  it('registers the configured interval and continues after a failed sweep', async () => {
    let registeredCallback: (() => void) | undefined
    let registeredInterval: number | undefined
    let executions = 0
    let stopped = false
    const loggedErrors: unknown[] = []

    const stopSweep = registerExpiredSessionSweep({
      sweepExpiredSessions: {
        execute: async () => {
          await Promise.resolve()
          executions += 1
          if (executions === 1) throw new DatabaseError('Sweep failed')
          return { expiredCount: 0 }
        },
      },
      logger: {
        error: ({ err }) => {
          loggedErrors.push(err)
        },
      },
      schedule: (callback, interval) => {
        registeredCallback = callback
        registeredInterval = interval
        return () => {
          stopped = true
        }
      },
    })

    expect(registeredInterval).toBe(SWEEP_INTERVAL_MS)

    registeredCallback?.()
    await new Promise<void>((resolve) => queueMicrotask(resolve))

    expect(executions).toBe(1)
    expect(loggedErrors).toHaveLength(1)

    registeredCallback?.()
    await new Promise<void>((resolve) => queueMicrotask(resolve))

    expect(executions).toBe(2)

    stopSweep()
    expect(stopped).toBe(true)
  })
})

describe('registerOrphanAnalysisReconciliationSweep', () => {
  it('registers the configured interval, sweeps with the stale threshold and limit, and continues after a failure', async () => {
    let registeredCallback: (() => void) | undefined
    let registeredInterval: number | undefined
    let executions = 0
    let stopped = false
    const loggedErrors: unknown[] = []
    const reconcileInputs: { staleAfterMs: number; limit: number }[] = []

    const stopSweep = registerOrphanAnalysisReconciliationSweep({
      reconcileOrphanAnalyses: {
        execute: async (input) => {
          await Promise.resolve()
          executions += 1
          reconcileInputs.push(input)
          if (executions === 1) throw new DatabaseError('Reconciliation failed')
          return { reconciledCount: 0 }
        },
      },
      logger: {
        error: ({ err }) => {
          loggedErrors.push(err)
        },
      },
      schedule: (callback, interval) => {
        registeredCallback = callback
        registeredInterval = interval
        return () => {
          stopped = true
        }
      },
    })

    expect(registeredInterval).toBe(ORPHAN_ANALYSIS_RECONCILIATION_INTERVAL_MS)

    registeredCallback?.()
    await new Promise<void>((resolve) => queueMicrotask(resolve))

    expect(executions).toBe(1)
    expect(loggedErrors).toHaveLength(1)

    registeredCallback?.()
    await new Promise<void>((resolve) => queueMicrotask(resolve))

    expect(executions).toBe(2)
    expect(reconcileInputs).toEqual([
      { staleAfterMs: ORPHAN_ANALYSIS_STALE_AFTER_MS, limit: ORPHAN_ANALYSIS_RECONCILIATION_LIMIT },
      { staleAfterMs: ORPHAN_ANALYSIS_STALE_AFTER_MS, limit: ORPHAN_ANALYSIS_RECONCILIATION_LIMIT },
    ])

    stopSweep()
    expect(stopped).toBe(true)
  })
})

describe('createAnalysisWorker', () => {
  it('creates the worker with the concurrency from config', () => {
    let capturedConcurrency: number | undefined

    createAnalysisWorker({
      processSessionAudio: { execute: () => Promise.resolve() },
      concurrency: 7,
      createWorker: (_processor, options) => {
        capturedConcurrency = options.concurrency
        return { close: () => Promise.resolve() }
      },
    })

    expect(capturedConcurrency).toBe(7)
  })

  it('translates AnalysisDeadlineExceededError into UnrecoverableError so BullMQ does not retry', async () => {
    let capturedProcessor:
      ((job: { readonly data: { readonly sessionId: string } }) => Promise<void>) | undefined

    createAnalysisWorker({
      processSessionAudio: {
        execute: () => Promise.reject(new FakeAnalysisDeadlineExceededError('Deadline exceeded')),
      },
      concurrency: 1,
      createWorker: (processor) => {
        capturedProcessor = processor
        return { close: () => Promise.resolve() }
      },
    })

    await expect(capturedProcessor?.({ data: { sessionId: 'session-1' } })).rejects.toMatchObject({
      name: 'UnrecoverableError',
    })
  })

  it('rethrows any other error unchanged so BullMQ retries up to attempts', async () => {
    let capturedProcessor:
      ((job: { readonly data: { readonly sessionId: string } }) => Promise<void>) | undefined
    const originalError = new DatabaseError('Connection lost')

    createAnalysisWorker({
      processSessionAudio: { execute: () => Promise.reject(originalError) },
      concurrency: 1,
      createWorker: (processor) => {
        capturedProcessor = processor
        return { close: () => Promise.resolve() }
      },
    })

    await expect(capturedProcessor?.({ data: { sessionId: 'session-1' } })).rejects.toBe(
      originalError,
    )
  })
})

describe('closeAnalysisWorker', () => {
  it('closes the worker before disconnecting the Redis connection', async () => {
    const calls: string[] = []

    await closeAnalysisWorker(
      { close: () => Promise.resolve().then(() => void calls.push('worker')) },
      { disconnect: () => void calls.push('redis') },
    )

    expect(calls).toEqual(['worker', 'redis'])
  })
})

describe('registerAnalysisPipelineModules', () => {
  it('subscribes to the four pipeline events on the worker process', async () => {
    const subscriptions: string[] = []
    const eventSubscriber = { subscribe: (eventName: string) => subscriptions.push(eventName) }
    const app = buildApp({ logger: createLogger({ level: 'silent', pretty: false }) })

    await registerAnalysisPipelineModules(app, {
      sessions: {
        prisma: createSessionsPrismaStub(),
        clock: { now: () => new Date() },
        idGenerator: { generate: () => 'id' },
        eventPublisher: { publish: () => Promise.resolve() },
        eventSubscriber,
        adapters: {
          accounts: {
            resolveAccountId: () => Promise.resolve(null),
            findProfile: () => Promise.resolve(null),
          },
          themes: {
            drawEligibleTheme: () => Promise.resolve(null),
            findThemeById: () => Promise.resolve({ themeId: 'theme-1', title: 'Theme' }),
            listCategories: () => Promise.resolve([]),
          },
          quota: {
            readBalance: () => Promise.resolve({ enforced: false }),
            reserveForSession: () =>
              Promise.resolve({ reservationId: 'id', enforced: true, remaining: 0 }),
            releaseReservation: () => Promise.resolve(),
          },
          audioStorage: {
            createUploadUrl: () =>
              Promise.resolve({ uploadUrl: 'memory://upload', token: 'token' }),
            createDownloadUrl: () => Promise.resolve('memory://download'),
            getObjectSize: () => Promise.resolve(null),
            downloadObject: () => Promise.resolve(Buffer.from('audio')),
            removeObject: () => Promise.resolve(),
          },
        },
      },
      analyses: {
        prisma: createAnalysesPrismaStub(),
        clock: { now: () => new Date() },
        idGenerator: { generate: () => 'id' },
        eventPublisher: { publish: () => Promise.resolve() },
        eventSubscriber,
        logger: { warn: () => undefined },
        costRates: {
          transcriptionCostPerMinuteMicros: 1,
          geminiInputCostPerMtokMicros: 1,
          geminiOutputCostPerMtokMicros: 1,
        },
        accountsFacade: {
          getAccountSnapshot: () =>
            Promise.resolve({
              accountId: 'account',
              plan: 'free' as const,
              createdAt: new Date(),
              timeZone: 'America/Sao_Paulo',
            }),
          authenticate: () => Promise.resolve({ accountId: null }),
        },
        themesFacade: {
          findThemeById: () =>
            Promise.resolve({
              themeId: 'theme',
              title: 'Theme',
              categorySlug: 'general',
              difficulty: 'easy',
            }),
        },
        adapters: {
          transcription: { transcribe: () => Promise.resolve(createTranscription()) },
          evaluation: { evaluate: () => Promise.resolve(createEvaluation()) },
          processingQueue: { enqueue: () => Promise.resolve() },
        },
      },
    })

    expect(subscriptions.toSorted()).toEqual(
      [
        'analysis_completed',
        'analysis_failed',
        'analysis_timeout',
        'recording_submitted',
      ].toSorted(),
    )
    await app.ready()
    expect(app.hasRoute({ method: 'GET', url: '/sessions/:sessionId/analysis' })).toBe(true)
    expect(app.hasRoute({ method: 'GET', url: '/sessions' })).toBe(true)
    await app.close()

    await app.close()
  })
})

function createSessionsPrismaStub(): SessionsPrismaClient & SessionsPrismaTransactionRunner {
  return {
    session: {
      findUnique: () => Promise.resolve(null),
      findFirst: () => Promise.resolve(null),
      findMany: () => Promise.resolve([]),
      upsert: () => Promise.resolve(createSessionRow()),
      updateMany: () => Promise.resolve({ count: 1 }),
    },
    $transaction: <T>(
      operation: (client: ReturnType<typeof createSessionsPrismaStub>) => Promise<T>,
    ) => operation(createSessionsPrismaStub()),
  }
}

function createSessionRow(): SessionRow {
  return {
    id: 'session-id',
    accountId: 'account-id',
    themeId: 'theme-id',
    difficulty: 'balanced',
    categorySlug: 'general',
    searchWindowMinutes: 4,
    quotaReservationId: 'reservation-id',
    state: 'in_progress',
    expiredReason: null,
    createdAt: new Date(),
    expiresAt: new Date(),
    expiredAt: null,
    recordedAt: null,
    totalScore: null,
    completedAt: null,
    audio: null,
  }
}

function createAnalysesPrismaStub(): AnalysesPrismaClient & AnalysesPrismaTransactionRunner {
  return {
    transcription: {
      findUnique: () => Promise.resolve(null),
      upsert: () => Promise.resolve(createTranscriptionRow()),
    },
    analysis: {
      findUnique: () => Promise.resolve(null),
      upsert: () => Promise.resolve(createAnalysisRow()),
      updateMany: () => Promise.resolve({ count: 0 }),
    },
    analysisCostEntry: {
      create: () => Promise.resolve(createCostEntryRow()),
      aggregate: () => Promise.resolve({ _sum: { totalMicrosUsd: null } }),
    },
    $transaction: <T>(
      operation: (client: ReturnType<typeof createAnalysesPrismaStub>) => Promise<T>,
    ) => operation(createAnalysesPrismaStub()),
  }
}

function createTranscription() {
  return {
    text: 'Transcript',
    words: [{ word: 'Transcript', start: 0, end: 1, confidence: 1 }],
    averageConfidence: 1,
    durationSeconds: 1,
  }
}

function createEvaluation() {
  return {
    clarityScore: 80,
    clarityGuidance: 'Clear',
    fluencyScore: 80,
    fluencyGuidance: 'Fluid',
    masteryScore: 80,
    masteryGuidance: 'Strong',
    inputTokens: 1,
    outputTokens: 1,
  }
}

function createTranscriptionRow() {
  return {
    id: 'transcription',
    sessionId: 'session',
    text: 'Transcript',
    words: [],
    averageConfidence: 1,
    durationSeconds: 1,
    createdAt: new Date(),
  }
}

function createAnalysisRow() {
  return {
    id: 'analysis',
    sessionId: 'session',
    clarityScore: 80,
    rhythmScore: 80,
    fluencyScore: 80,
    masteryScore: 80,
    totalScore: 80,
    guidance: { clarity: 'Clear', rhythm: 'On target', fluency: 'Fluid', mastery: 'Strong' },
    rhythmMetrics: {
      wordsPerMinute: 130,
      wordCount: 1,
      speechDurationSeconds: 1,
      pauseCount: 0,
      longPauseCount: 0,
      longestPauseSeconds: 0,
    },
    processingMs: 1,
    costMicrosUsd: 1,
    createdAt: new Date(),
  }
}

function createCostEntryRow() {
  return {
    id: 'cost',
    sessionId: 'session',
    accountId: 'account',
    transcriptionMicrosUsd: 1,
    evaluationMicrosUsd: 1,
    totalMicrosUsd: 2,
    incurredAt: new Date(),
  }
}

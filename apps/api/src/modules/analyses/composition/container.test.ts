import { describe, expect, it } from 'vitest'

import { OperationFailedError } from '@/shared/errors/operation-failed-error/index.js'
import type {
  AnalysesPrismaClient,
  AnalysesPrismaTransactionRunner,
} from '@/modules/analyses/infrastructure/clients/analyses-prisma-client/index.js'

import { createAnalysesContainer } from './container.js'

describe('createAnalysesContainer', () => {
  it('mounts with overridden adapters', () => {
    const container = createAnalysesContainer({
      prisma: createPrismaStub(),
      clock: { now: () => new Date('2026-01-01T00:00:00.000Z') },
      idGenerator: { generate: () => 'generated-id' },
      eventPublisher: { publish: () => Promise.resolve() },
      eventSubscriber: { subscribe: () => undefined },
      logger: createLoggerStub(),
      costRates: {
        transcriptionCostPerMinuteMicros: 1,
        geminiInputCostPerMtokMicros: 1,
        geminiOutputCostPerMtokMicros: 1,
      },
      sessionsFacade: {
        findProcessingContext: () => Promise.resolve(null),
        downloadAudio: () => Promise.resolve(createAudioContent()),
        checkReadability: () => Promise.resolve({ failureReason: null, readable: false }),
        listStuckProcessing: () => Promise.resolve([]),
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
        accounts: {
          findPlan: () => Promise.resolve('free'),
          resolveAccountId: () => Promise.resolve(null),
        },
        sessions: {
          findProcessingContext: () => Promise.resolve(null),
          checkAnalysisAccess: () => Promise.resolve({ failure: null, readable: false }),
          listStuckProcessing: () => Promise.resolve([]),
        },
        audioReader: { read: () => Promise.resolve(createAudioContent()) },
        themes: { findTitle: () => Promise.resolve('Theme') },
        transcription: { transcribe: () => Promise.resolve(createTranscription()) },
        evaluation: { evaluate: () => Promise.resolve(createEvaluation()) },
        processingQueue: { enqueue: () => Promise.resolve() },
      },
    })

    expect(container.useCases.enqueueSessionAnalysis).toBeDefined()
    expect(container.useCases.processSessionAudio).toBeDefined()
  })

  it('reports a missing required dependency', () => {
    expect(() => createAnalysesContainer({})).toThrowError(OperationFailedError)

    try {
      createAnalysesContainer({})
    } catch (error) {
      expect(error).toMatchObject({ context: { missingDependency: 'prisma' } })
    }
  })

  it('mounts the Deepgram, Gemini and BullMQ adapters from raw clients when adapters overrides are not provided', () => {
    const container = createAnalysesContainer({
      ...baseDeps(),
      deepgramClient: {
        listen: { v1: { media: { transcribeFile: () => Promise.resolve(undefined) } } },
      },
      geminiClient: { models: { generateContent: () => Promise.resolve(undefined) } },
      geminiModel: 'gemini-2.5-flash',
      bullMqQueue: { add: () => Promise.resolve(undefined) },
    })

    expect(container.useCases.enqueueSessionAnalysis).toBeDefined()
    expect(container.useCases.processSessionAudio).toBeDefined()
  })

  it('reports a missing deepgramClient dependency when adapters overrides are not provided', () => {
    try {
      createAnalysesContainer(baseDeps())
      expect.unreachable('createAnalysesContainer should have thrown')
    } catch (error) {
      expect(error).toMatchObject({ context: { missingDependency: 'deepgramClient' } })
    }
  })
})

function baseDeps() {
  return {
    prisma: createPrismaStub(),
    clock: { now: () => new Date('2026-01-01T00:00:00.000Z') },
    idGenerator: { generate: () => 'generated-id' },
    eventPublisher: { publish: () => Promise.resolve() },
    eventSubscriber: { subscribe: () => undefined },
    logger: createLoggerStub(),
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
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          timeZone: 'America/Sao_Paulo',
        }),
      authenticate: () => Promise.resolve({ accountId: null }),
    },
    sessionsFacade: {
      findProcessingContext: () => Promise.resolve(null),
      downloadAudio: () => Promise.resolve(createAudioContent()),
      checkReadability: () => Promise.resolve({ failureReason: null, readable: false }),
      listStuckProcessing: () => Promise.resolve([]),
    },
    themesFacade: {
      findThemeById: () =>
        Promise.resolve({
          themeId: 'theme',
          title: 'Theme',
          categorySlug: 'general' as const,
          difficulty: 'easy' as const,
        }),
    },
  }
}

function createPrismaStub(): AnalysesPrismaClient & AnalysesPrismaTransactionRunner {
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
    communicationAnalysis: {
      findUnique: () => Promise.resolve(null),
      create: (args) => Promise.resolve(args.data),
    },
    analysisCostEntry: {
      create: () => Promise.resolve(createCostEntryRow()),
      aggregate: () => Promise.resolve({ _sum: { totalMicrosUsd: null } }),
    },
    $transaction: <T>(operation: (client: ReturnType<typeof createPrismaStub>) => Promise<T>) =>
      operation(createPrismaStub()),
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
    auditoryMicrosUsd: 0,
    synthesisMicrosUsd: 0,
    totalMicrosUsd: 2,
    incurredAt: new Date(),
  }
}

function createLoggerStub() {
  return { warn: () => undefined }
}

function createAudioContent() {
  return { bytes: Buffer.from('audio'), contentType: 'audio/webm', durationSeconds: 30 }
}

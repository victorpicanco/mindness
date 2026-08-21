import { describe, expect, it } from 'vitest'

import { registerAnalysesModule } from './register.js'
import type {
  AnalysesPrismaClient,
  AnalysesPrismaTransactionRunner,
} from '@/modules/analyses/infrastructure/clients/analyses-prisma-client/index.js'

describe('registerAnalysesModule', () => {
  it('subscribes to recording_submitted', () => {
    const subscriptions: string[] = []
    registerAnalysesModule(undefined, {
      prisma: createPrismaStub(),
      clock: { now: () => new Date() },
      idGenerator: { generate: () => 'id' },
      eventPublisher: { publish: () => Promise.resolve() },
      eventSubscriber: { subscribe: (eventName) => subscriptions.push(eventName) },
      logger: { warn: () => undefined },
      costRates: {
        transcriptionCostPerMinuteMicros: 1,
        geminiInputCostPerMtokMicros: 1,
        geminiOutputCostPerMtokMicros: 1,
      },
      accountsFacade: { findPlan: () => Promise.resolve('free') },
      sessionsFacade: {
        findProcessingContext: () => Promise.resolve(null),
        downloadAudio: () => Promise.resolve(Buffer.from('audio')),
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
    })

    expect(subscriptions).toContain('recording_submitted')
  })
})

function createPrismaStub(): AnalysesPrismaClient & AnalysesPrismaTransactionRunner {
  return {
    transcription: {
      findUnique: () => Promise.resolve(null),
      upsert: () => Promise.resolve(createTranscriptionRow()),
    },
    analysis: {
      findUnique: () => Promise.resolve(null),
      upsert: () => Promise.resolve(createAnalysisRow()),
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
    totalMicrosUsd: 2,
    incurredAt: new Date(),
  }
}

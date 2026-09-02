import { describe, expect, it } from 'vitest'

import type {
  AnalysesPrismaClient,
  AnalysesPrismaTransactionRunner,
} from '@/modules/analyses/infrastructure/clients/analyses-prisma-client/index.js'
import { OperationFailedError } from '@/shared/errors/operation-failed-error/index.js'

import { createAnalysesContainer } from './container.js'

describe('createAnalysesContainer', () => {
  it('builds one speech-analysis pipeline from overridden adapters', () => {
    const container = createAnalysesContainer({
      prisma: createPrismaStub(),
      clock: { now: () => new Date() },
      idGenerator: { generate: () => 'id' },
      eventPublisher: { publish: () => Promise.resolve() },
      logger: { warn: () => undefined },
      costRates: {
        transcriptionCostPerMinuteMicros: 1,
        geminiInputCostPerMtokMicros: 1,
        geminiOutputCostPerMtokMicros: 1,
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
        audioPreparation: {
          prepare: () =>
            Promise.resolve({
              bytes: Buffer.from('flac'),
              contentType: 'audio/flac',
              durationSeconds: 1,
            }),
        },
        audioReader: {
          read: () =>
            Promise.resolve({
              bytes: Buffer.from('audio'),
              contentType: 'audio/webm',
              durationSeconds: 1,
            }),
        },
        themes: { findTitle: () => Promise.resolve('Theme') },
        transcription: {
          transcribe: () =>
            Promise.resolve({
              text: 'Transcript',
              words: [{ word: 'Transcript', start: 0, end: 1, confidence: 1 }],
              averageConfidence: 1,
              durationSeconds: 1,
            }),
        },
        evaluation: {
          evaluate: () =>
            Promise.resolve({
              feedback: { summary: 'Clear.', strengths: [], improvements: [] },
              inputTokens: 1,
              outputTokens: 1,
            }),
        },
        processingQueue: { enqueue: () => Promise.resolve() },
      },
    })

    expect(container.useCases.processSessionAudio).toBeDefined()
    expect(container.repositories).not.toHaveProperty('communicationAnalyses')
  })

  it('reports a missing required dependency', () => {
    expect(() => createAnalysesContainer({})).toThrow(OperationFailedError)
  })
})

function createPrismaStub(): AnalysesPrismaClient & AnalysesPrismaTransactionRunner {
  const client: AnalysesPrismaClient & AnalysesPrismaTransactionRunner = {
    transcription: {
      findUnique: () => Promise.resolve(null),
      upsert: (args) => Promise.resolve(args.create),
    },
    analysis: {
      findUnique: () => Promise.resolve(null),
      upsert: (args) => Promise.resolve(args.create),
      updateMany: () => Promise.resolve({ count: 0 }),
    },
    analysisCostEntry: {
      create: (args) => Promise.resolve(args.data),
      aggregate: () => Promise.resolve({ _sum: { totalMicrosUsd: null } }),
    },
    $transaction: (operation) => operation(client),
  }
  return client
}

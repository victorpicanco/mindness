import { describe, expect, it } from 'vitest'

import type { Analysis } from '@/modules/analyses/domain/entities/analysis/index.js'
import type {
  AnalysesPrismaClient,
  AnalysisRow,
} from '@/modules/analyses/infrastructure/clients/analyses-prisma-client/index.js'
import { AnalysesTransactionContext } from '@/modules/analyses/infrastructure/clients/analyses-transaction-context/index.js'
import { AnalysisMapper } from '@/modules/analyses/infrastructure/mappers/analysis-mapper/index.js'

import { PrismaAnalysesRepository } from './index.js'

const row: AnalysisRow = {
  id: 'analysis-id',
  sessionId: 'session-id',
  clarityScore: 80,
  rhythmScore: 70,
  fluencyScore: 60,
  masteryScore: 90,
  totalScore: 75,
  guidance: {
    clarity: 'Be clearer',
    rhythm: 'Keep pace',
    fluency: 'Speak smoothly',
    mastery: 'Know the subject',
  },
  rhythmMetrics: {
    wordsPerMinute: 140,
    wordCount: 20,
    speechDurationSeconds: 8,
    pauseCount: 2,
    longPauseCount: 1,
    longestPauseSeconds: 2.5,
  },
  processingMs: 1234,
  costMicrosUsd: 42,
  createdAt: new Date('2026-08-21T12:00:00.000Z'),
}

class FakePrismaClient implements AnalysesPrismaClient {
  upsertCalls: { readonly where: { readonly sessionId: string } }[] = []

  readonly analysis: AnalysesPrismaClient['analysis'] = {
    findUnique: () => Promise.resolve(null),
    upsert: (args) => {
      this.upsertCalls.push({ where: args.where })
      return Promise.resolve(args.create)
    },
  }

  readonly transcription: AnalysesPrismaClient['transcription'] = {
    findUnique: () => Promise.resolve(null),
    upsert: (args) => Promise.resolve(args.create),
  }

  readonly analysisCostEntry: AnalysesPrismaClient['analysisCostEntry'] = {
    create: (args) => Promise.resolve(args.data),
    aggregate: () => Promise.resolve({ _sum: { totalMicrosUsd: null } }),
  }
}

describe('PrismaAnalysesRepository', () => {
  it('upserts by the session id, the natural key of a one-analysis-per-session invariant', async () => {
    const fake = new FakePrismaClient()
    const repository = new PrismaAnalysesRepository(
      fake,
      new AnalysesTransactionContext(),
      new AnalysisMapper(),
    )
    const analysis: Analysis = new AnalysisMapper().toDomain(row)

    await repository.save(analysis)

    expect(fake.upsertCalls).toEqual([{ where: { sessionId: 'session-id' } }])
  })
})

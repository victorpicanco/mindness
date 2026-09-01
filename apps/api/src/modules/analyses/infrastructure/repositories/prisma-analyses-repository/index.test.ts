import { describe, expect, it } from 'vitest'

import type { Analysis } from '@/modules/analyses/domain/entities/analysis/index.js'
import type {
  AnalysesPrismaClient,
  AnalysisRow,
} from '@/modules/analyses/infrastructure/clients/analyses-prisma-client/index.js'
import { AnalysesTransactionContext } from '@/modules/analyses/infrastructure/clients/analyses-transaction-context/index.js'
import { AnalysisMapper } from '@/modules/analyses/infrastructure/mappers/analysis-mapper/index.js'
import { DatabaseError } from '@/shared/errors/database-error/index.js'

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
  updateManyCalls: {
    readonly where: { readonly sessionId: string; readonly viewedAt: null }
    readonly data: { readonly viewedAt: Date }
  }[] = []
  updateManyResult: { readonly count: number } = { count: 1 }
  updateManyFailure: DatabaseError | null = null

  readonly analysis: AnalysesPrismaClient['analysis'] = {
    findUnique: () => Promise.resolve(null),
    upsert: (args) => {
      this.upsertCalls.push({ where: args.where })
      return Promise.resolve(args.create)
    },
    updateMany: (args) => {
      this.updateManyCalls.push(args)
      if (this.updateManyFailure !== null) return Promise.reject(this.updateManyFailure)
      return Promise.resolve(this.updateManyResult)
    },
  }

  readonly transcription: AnalysesPrismaClient['transcription'] = {
    findUnique: () => Promise.resolve(null),
    upsert: (args) => Promise.resolve(args.create),
  }

  readonly communicationAnalysis: AnalysesPrismaClient['communicationAnalysis'] = {
    findUnique: () => Promise.resolve(null),
    create: (args) => Promise.resolve(args.data),
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

  it('marks the first view only when the analysis has not been viewed', async () => {
    const fake = new FakePrismaClient()
    const repository = new PrismaAnalysesRepository(
      fake,
      new AnalysesTransactionContext(),
      new AnalysisMapper(),
    )
    const viewedAt = new Date('2026-08-22T12:00:00.000Z')

    await expect(repository.markFirstView('session-id', viewedAt)).resolves.toBe(true)
    expect(fake.updateManyCalls).toEqual([
      { where: { sessionId: 'session-id', viewedAt: null }, data: { viewedAt } },
    ])
  })

  it('returns false when the analysis was already viewed', async () => {
    const fake = new FakePrismaClient()
    fake.updateManyResult = { count: 0 }
    const repository = new PrismaAnalysesRepository(
      fake,
      new AnalysesTransactionContext(),
      new AnalysisMapper(),
    )

    await expect(
      repository.markFirstView('session-id', new Date('2026-08-22T12:00:00.000Z')),
    ).resolves.toBe(false)
  })

  it('translates client failures to a database error', async () => {
    const fake = new FakePrismaClient()
    fake.updateManyFailure = new DatabaseError('Client failure')
    const repository = new PrismaAnalysesRepository(
      fake,
      new AnalysesTransactionContext(),
      new AnalysisMapper(),
    )

    await expect(
      repository.markFirstView('session-id', new Date('2026-08-22T12:00:00.000Z')),
    ).rejects.toMatchObject({
      code: 'shared.DATABASE_ERROR',
      context: { sessionId: 'session-id' },
    })
  })
})

import { describe, expect, it } from 'vitest'

import { CommunicationAnalysis } from '@/modules/analyses/domain/entities/communication-analysis/index.js'
import { CommunicationFeedback } from '@/modules/analyses/domain/value-objects/communication-feedback/index.js'
import type {
  AnalysesPrismaClient,
  CommunicationAnalysisRow,
} from '@/modules/analyses/infrastructure/clients/analyses-prisma-client/index.js'
import { AnalysesTransactionContext } from '@/modules/analyses/infrastructure/clients/analyses-transaction-context/index.js'
import { CommunicationAnalysisMapper } from '@/modules/analyses/infrastructure/mappers/communication-analysis-mapper/index.js'
import { DatabaseError } from '@/shared/errors/database-error/index.js'

import { PrismaCommunicationAnalysesRepository } from './index.js'

const feedback = CommunicationFeedback.create({
  durationSeconds: 30,
  audioUsability: 'usable',
  alignmentQuality: 'reliable',
  limitations: [],
  literalTranscript: 'entao eee eu acho que o ponto principal e este',
  mainMessage: 'The speaker defends remote work.',
  attemptedStructure: 'Opening, argument and closing.',
  summary: 'The message arrives complete. A filler opens the argument.',
  strengths: [],
  moments: [],
  patterns: [],
  asrDivergences: [],
  priorities: [],
})

const analysis = CommunicationAnalysis.create({
  analysisId: 'analysis-id',
  sessionId: 'session-id',
  promptVersion: 'speech-feedback-v1',
  feedback,
  processingMs: 4321,
  costMicrosUsd: 3800,
  createdAt: new Date('2026-09-01T12:00:00.000Z'),
})

class FakePrismaClient implements AnalysesPrismaClient {
  readonly rows = new Map<string, CommunicationAnalysisRow>()
  createFailure: DatabaseError | null = null

  readonly communicationAnalysis: AnalysesPrismaClient['communicationAnalysis'] = {
    findUnique: (args) => Promise.resolve(this.rows.get(args.where.sessionId) ?? null),
    create: (args) => {
      if (this.createFailure !== null) return Promise.reject(this.createFailure)
      if (this.rows.has(args.data.sessionId)) {
        return Promise.reject(new DatabaseError('Unique constraint failed on session_id'))
      }
      this.rows.set(args.data.sessionId, args.data)
      return Promise.resolve(args.data)
    },
  }

  readonly analysis: AnalysesPrismaClient['analysis'] = {
    findUnique: () => Promise.resolve(null),
    upsert: (args) => Promise.resolve(args.create),
    updateMany: () => Promise.resolve({ count: 0 }),
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

const createRepository = (prisma: FakePrismaClient): PrismaCommunicationAnalysesRepository =>
  new PrismaCommunicationAnalysesRepository(
    prisma,
    new AnalysesTransactionContext(),
    new CommunicationAnalysisMapper(),
  )

describe('PrismaCommunicationAnalysesRepository', () => {
  it('persists the feedback and reads it back without loss', async () => {
    const prisma = new FakePrismaClient()
    const repository = createRepository(prisma)

    await repository.save(analysis)

    await expect(repository.findBySessionId('session-id')).resolves.toEqual(analysis)
  })

  it('rejects a second analysis for the same session', async () => {
    const prisma = new FakePrismaClient()
    const repository = createRepository(prisma)

    await repository.save(analysis)

    await expect(repository.save(analysis)).rejects.toMatchObject({
      code: 'shared.DATABASE_ERROR',
      context: { sessionId: 'session-id' },
    })
  })

  it('returns null when the session has no second version analysis', async () => {
    const repository = createRepository(new FakePrismaClient())

    await expect(repository.findBySessionId('other-session')).resolves.toBeNull()
  })

  it('translates client failures to a database error', async () => {
    const prisma = new FakePrismaClient()
    prisma.createFailure = new DatabaseError('Client failure')
    const repository = createRepository(prisma)

    await expect(repository.save(analysis)).rejects.toMatchObject({
      code: 'shared.DATABASE_ERROR',
      context: { sessionId: 'session-id' },
    })
  })

  it('runs inside the transaction client when one is active', async () => {
    const ambient = new FakePrismaClient()
    const transactional = new FakePrismaClient()
    const context = new AnalysesTransactionContext()
    const repository = new PrismaCommunicationAnalysesRepository(
      ambient,
      context,
      new CommunicationAnalysisMapper(),
    )

    await context.run(transactional, () => repository.save(analysis))

    expect(transactional.rows.has('session-id')).toBe(true)
    expect(ambient.rows.has('session-id')).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'

import type { Transcription } from '@/modules/analyses/domain/entities/transcription/index.js'
import type {
  AnalysesPrismaClient,
  TranscriptionRow,
} from '@/modules/analyses/infrastructure/clients/analyses-prisma-client/index.js'
import { AnalysesTransactionContext } from '@/modules/analyses/infrastructure/clients/analyses-transaction-context/index.js'
import { TranscriptionMapper } from '@/modules/analyses/infrastructure/mappers/transcription-mapper/index.js'

import { PrismaTranscriptionsRepository } from './index.js'

const row: TranscriptionRow = {
  id: 'transcription-id',
  sessionId: 'session-id',
  text: 'Olá mundo',
  words: [{ word: 'Olá', start: 0, end: 0.4, confidence: 0.99 }],
  averageConfidence: 0.99,
  durationSeconds: 62.34,
  createdAt: new Date('2026-08-21T12:00:00.000Z'),
}

class FakePrismaClient implements AnalysesPrismaClient {
  upsertCalls: { readonly where: { readonly sessionId: string } }[] = []

  readonly transcription: AnalysesPrismaClient['transcription'] = {
    findUnique: () => Promise.resolve(null),
    upsert: (args) => {
      this.upsertCalls.push({ where: args.where })
      return Promise.resolve(args.create)
    },
  }

  readonly analysis: AnalysesPrismaClient['analysis'] = {
    findUnique: () => Promise.resolve(null),
    upsert: (args) => Promise.resolve(args.create),
  }

  readonly analysisCostEntry: AnalysesPrismaClient['analysisCostEntry'] = {
    create: (args) => Promise.resolve(args.data),
    aggregate: () => Promise.resolve({ _sum: { totalMicrosUsd: null } }),
  }
}

describe('PrismaTranscriptionsRepository', () => {
  it('upserts by the session id, the natural key of a one-transcription-per-session invariant', async () => {
    const fake = new FakePrismaClient()
    const repository = new PrismaTranscriptionsRepository(
      fake,
      new AnalysesTransactionContext(),
      new TranscriptionMapper(),
    )
    const transcription: Transcription = new TranscriptionMapper().toDomain(row)

    await repository.save(transcription)

    expect(fake.upsertCalls).toEqual([{ where: { sessionId: 'session-id' } }])
  })
})

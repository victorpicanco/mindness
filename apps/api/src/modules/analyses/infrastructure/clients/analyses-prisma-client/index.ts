import type { PrismaClient, Prisma } from '@/generated/prisma/client.js'
import { DatabaseError } from '@/shared/errors/database-error/index.js'

export interface TranscriptionRow {
  readonly id: string
  readonly sessionId: string
  readonly text: string
  readonly words: unknown
  readonly averageConfidence: number
  readonly durationSeconds: number
  readonly createdAt: Date
}

export interface AnalysisRow {
  readonly id: string
  readonly sessionId: string
  readonly clarityScore: number
  readonly rhythmScore: number
  readonly fluencyScore: number
  readonly masteryScore: number
  readonly totalScore: number
  readonly guidance: unknown
  readonly rhythmMetrics: unknown
  readonly processingMs: number
  readonly costMicrosUsd: number
  readonly createdAt: Date
  readonly viewedAt?: Date | null
}

export interface AnalysisCostEntryRow {
  readonly id: string
  readonly sessionId: string
  readonly accountId: string
  readonly transcriptionMicrosUsd: number
  readonly evaluationMicrosUsd: number
  readonly totalMicrosUsd: number
  readonly incurredAt: Date
}

export interface AnalysesPrismaClient {
  readonly transcription: {
    findUnique(args: {
      readonly where: { readonly sessionId: string }
    }): Promise<TranscriptionRow | null>
    upsert(args: {
      readonly where: { readonly sessionId: string }
      readonly create: TranscriptionRow
      readonly update: TranscriptionRow
    }): Promise<TranscriptionRow>
  }
  readonly analysis: {
    findUnique(args: {
      readonly where: { readonly sessionId: string }
    }): Promise<AnalysisRow | null>
    upsert(args: {
      readonly where: { readonly sessionId: string }
      readonly create: AnalysisRow
      readonly update: AnalysisRow
    }): Promise<AnalysisRow>
    updateMany(args: {
      readonly where: { readonly sessionId: string; readonly viewedAt: null }
      readonly data: { readonly viewedAt: Date }
    }): Promise<{ readonly count: number }>
  }
  readonly analysisCostEntry: {
    create(args: { readonly data: AnalysisCostEntryRow }): Promise<AnalysisCostEntryRow>
    aggregate(args: {
      readonly _sum: { readonly totalMicrosUsd: true }
      readonly where: { readonly incurredAt: { readonly gte: Date; readonly lt: Date } }
    }): Promise<{ readonly _sum: { readonly totalMicrosUsd: number | null } }>
  }
}

export interface AnalysesPrismaTransactionRunner {
  $transaction<T>(
    operation: (transaction: AnalysesPrismaClient) => Promise<T>,
    options: { readonly isolationLevel: 'Serializable' },
  ): Promise<T>
}

type AnalysesPrismaDelegates = Pick<
  PrismaClient,
  'transcription' | 'analysis' | 'analysisCostEntry'
>

export function createAnalysesPrismaClient(
  prisma: PrismaClient,
): AnalysesPrismaClient & AnalysesPrismaTransactionRunner {
  return {
    ...createNarrowClient(prisma),
    $transaction: (operation, options) =>
      prisma.$transaction((transaction) => operation(createNarrowClient(transaction)), options),
  }
}

function createNarrowClient(prisma: AnalysesPrismaDelegates): AnalysesPrismaClient {
  return {
    transcription: {
      findUnique: (args) => prisma.transcription.findUnique(args),
      upsert: (args) =>
        prisma.transcription.upsert({
          where: args.where,
          create: { ...args.create, words: toInputJson(args.create.words) },
          update: { ...args.update, words: toInputJson(args.update.words) },
        }),
    },
    analysis: {
      findUnique: (args) => prisma.analysis.findUnique(args),
      upsert: (args) =>
        prisma.analysis.upsert({
          where: args.where,
          create: {
            ...args.create,
            guidance: toInputJson(args.create.guidance),
            rhythmMetrics: toInputJson(args.create.rhythmMetrics),
          },
          update: {
            ...args.update,
            guidance: toInputJson(args.update.guidance),
            rhythmMetrics: toInputJson(args.update.rhythmMetrics),
          },
        }),
      updateMany: (args) => prisma.analysis.updateMany(args),
    },
    analysisCostEntry: {
      create: (args) => prisma.analysisCostEntry.create(args),
      aggregate: (args) => prisma.analysisCostEntry.aggregate(args),
    },
  }
}

interface JsonObject {
  [key: string]: Prisma.InputJsonValue
}

function toInputJson(value: unknown): Prisma.InputJsonValue {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value
  }
  if (Array.isArray(value)) return value.map(toInputJson)
  if (typeof value === 'object' && value !== null) {
    const object: JsonObject = {}
    for (const [key, entry] of Object.entries(value)) object[key] = toInputJson(entry)
    return object
  }
  throw new DatabaseError('Invalid JSON value for analysis persistence')
}

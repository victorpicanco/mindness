import type {
  SessionDifficulty,
  SessionExpiredReason,
  SessionState,
} from '@/generated/prisma/enums.js'

export interface SessionAudioRow {
  readonly id: string
  readonly sessionId: string
  readonly durationSeconds: number
  readonly sizeBytes: number
  readonly contentType: string
  readonly storagePath: string
  readonly createdAt: Date
}

export interface SessionRow {
  readonly id: string
  readonly accountId: string
  readonly themeId: string
  readonly difficulty: SessionDifficulty
  readonly categorySlug: string
  readonly searchWindowMinutes: number
  readonly quotaReservationId: string
  readonly state: SessionState
  readonly expiredReason: SessionExpiredReason | null
  readonly createdAt: Date
  readonly expiresAt: Date
  readonly expiredAt: Date | null
  readonly audio?: SessionAudioRow | null
}

export interface SessionScalars {
  readonly id: string
  readonly accountId: string
  readonly themeId: string
  readonly difficulty: SessionDifficulty
  readonly categorySlug: string
  readonly searchWindowMinutes: number
  readonly quotaReservationId: string
  readonly state: SessionState
  readonly expiredReason: SessionExpiredReason | null
  readonly createdAt: Date
  readonly expiresAt: Date
  readonly expiredAt: Date | null
}

export interface SessionFindByIdArgs {
  readonly where: { readonly id: string }
  readonly include: { readonly audio: true }
}

export interface SessionFindActiveArgs {
  readonly where: { readonly accountId: string; readonly state: 'in_progress' }
  readonly include: { readonly audio: true }
}

export interface SessionFindExpiredArgs {
  readonly where: {
    readonly state: 'in_progress'
    readonly expiresAt: { readonly lte: Date }
  }
  readonly include: { readonly audio: true }
  readonly take: number
}

export interface SessionAudioCreateData {
  readonly id: string
  readonly durationSeconds: number
  readonly sizeBytes: number
  readonly contentType: string
  readonly storagePath: string
  readonly createdAt: Date
}

export interface SessionAudioUpdateData {
  readonly durationSeconds: number
  readonly sizeBytes: number
  readonly contentType: string
  readonly storagePath: string
}

export interface SessionCreateData extends SessionScalars {
  readonly audio?: { readonly create: SessionAudioCreateData }
}

export interface SessionUpdateData extends SessionScalars {
  readonly audio?: {
    readonly upsert: {
      readonly create: SessionAudioCreateData
      readonly update: SessionAudioUpdateData
    }
  }
}

export interface SessionUpsertArgs {
  readonly where: { readonly id: string }
  readonly create: SessionCreateData
  readonly update: SessionUpdateData
}

export interface SessionsPrismaClient {
  readonly session: {
    findUnique(args: SessionFindByIdArgs): Promise<SessionRow | null>
    findFirst(args: SessionFindActiveArgs): Promise<SessionRow | null>
    findMany(args: SessionFindExpiredArgs): Promise<SessionRow[]>
    upsert(args: SessionUpsertArgs): Promise<SessionRow>
  }
}

export interface TransactionOptions {
  readonly isolationLevel: 'Serializable'
}

export interface SessionsPrismaTransactionRunner {
  $transaction<T>(
    operation: (transaction: SessionsPrismaClient) => Promise<T>,
    options: TransactionOptions,
  ): Promise<T>
}

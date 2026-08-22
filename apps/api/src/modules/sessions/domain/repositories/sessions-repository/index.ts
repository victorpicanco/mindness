import type { Session } from '@/modules/sessions/domain/entities/session/index.js'

export interface SessionsRepository {
  findById(sessionId: string): Promise<Session | null>
  findActiveByAccountId(accountId: string): Promise<Session | null>
  listByAccount(input: {
    readonly accountId: string
    readonly limit: number
    readonly cursor: string | null
  }): Promise<Session[]>
  findCompletedBetween(accountId: string, from: Date, to: Date): Promise<Session[]>
  findExpiredInProgress(before: Date, limit: number): Promise<Session[]>
  findStuckProcessing(before: Date, limit: number): Promise<Session[]>
  save(session: Session): Promise<void>
}

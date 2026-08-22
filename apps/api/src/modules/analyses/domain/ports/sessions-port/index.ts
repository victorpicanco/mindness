import type { SessionProcessingContext } from './types.js'

export interface SessionsPort {
  findProcessingContext(sessionId: string): Promise<SessionProcessingContext | null>
  listStuckProcessing(before: Date, limit: number): Promise<readonly string[]>
}

export type { SessionProcessingContext } from './types.js'

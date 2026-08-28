import type { AnalysisAccess, SessionProcessingContext } from './types.js'

export interface SessionsPort {
  findProcessingContext(sessionId: string): Promise<SessionProcessingContext | null>
  listStuckProcessing(before: Date, limit: number): Promise<readonly string[]>
  checkAnalysisAccess(sessionId: string, accountId: string): Promise<AnalysisAccess>
}

export type { AnalysisAccess, AnalysisFailure, SessionProcessingContext } from './types.js'

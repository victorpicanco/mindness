import type { SessionProcessingContext } from './types.js'

export interface SessionsPort {
  findProcessingContext(sessionId: string): Promise<SessionProcessingContext | null>
}

export type { SessionProcessingContext } from './types.js'

import type { SessionsRepository } from '@/modules/sessions/domain/repositories/sessions-repository/index.js'

export interface ListStuckProcessingSessionsInput {
  readonly before: Date
  readonly limit: number
}

export type ListStuckProcessingSessionsOutput = readonly string[]

export interface ListStuckProcessingSessionsDependencies {
  readonly sessions: Pick<SessionsRepository, 'findStuckProcessing'>
}

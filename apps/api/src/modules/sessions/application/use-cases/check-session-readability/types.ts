import type { SessionsRepository } from '@/modules/sessions/domain/repositories/sessions-repository/index.js'

export interface CheckSessionReadabilityInput {
  readonly accountId: string
  readonly sessionId: string
}

export interface CheckSessionReadabilityOutput {
  readonly readable: boolean
}

export interface CheckSessionReadabilityDependencies {
  readonly sessions: Pick<SessionsRepository, 'findById'>
}

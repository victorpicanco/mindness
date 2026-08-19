import { SessionAlreadyRunningError } from '@/modules/sessions/domain/errors/session-already-running-error/index.js'
import type { Clock } from '@/modules/sessions/domain/ports/clock/index.js'
import type { QuotaPort } from '@/modules/sessions/domain/ports/quota-port/index.js'
import type { ThemesPort } from '@/modules/sessions/domain/ports/themes-port/index.js'
import type { SessionsRepository } from '@/modules/sessions/domain/repositories/sessions-repository/index.js'

import type { StartSessionInput } from './types.js'

export interface StartSessionDependencies {
  readonly sessions: SessionsRepository
  readonly themes: ThemesPort
  readonly quota: QuotaPort
  readonly clock: Clock
}

export class StartSessionUseCase {
  constructor(private readonly dependencies: StartSessionDependencies) {}

  async execute(input: StartSessionInput): Promise<void> {
    const activeSession = await this.dependencies.sessions.findActiveByAccountId(input.accountId)

    if (
      activeSession !== null &&
      activeSession.expiresAt.getTime() > this.dependencies.clock.now().getTime()
    ) {
      throw new SessionAlreadyRunningError(activeSession.id)
    }
  }
}

export type { StartSessionInput } from './types.js'

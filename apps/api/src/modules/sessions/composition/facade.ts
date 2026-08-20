import type { SweepExpiredSessionsUseCase } from '@/modules/sessions/application/use-cases/sweep-expired-sessions/index.js'

export interface SessionsFacade {
  sweepExpiredSessions(): Promise<void>
}

export function createSessionsFacade(dependencies: {
  readonly sweepExpiredSessions: SweepExpiredSessionsUseCase
}): SessionsFacade {
  return {
    sweepExpiredSessions: async () => {
      await dependencies.sweepExpiredSessions.execute()
    },
  }
}

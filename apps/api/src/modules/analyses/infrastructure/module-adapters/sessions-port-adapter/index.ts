import type { SessionsPublicApi } from '@/modules/sessions/index.js'
import type {
  AnalysisAccess,
  SessionsPort,
} from '@/modules/analyses/domain/ports/sessions-port/index.js'

export type SessionsProcessingContextReader = Pick<
  SessionsPublicApi,
  'checkReadability' | 'findProcessingContext' | 'listStuckProcessing'
>
export class SessionsPortAdapter implements SessionsPort {
  constructor(private readonly sessions: SessionsProcessingContextReader) {}

  async findProcessingContext(sessionId: string) {
    const context = await this.sessions.findProcessingContext(sessionId)
    return context === null
      ? null
      : {
          sessionId: context.sessionId,
          accountId: context.accountId,
          themeId: context.themeId,
          audioPath: context.audioPath,
          recordedAt: context.recordedAt,
        }
  }

  listStuckProcessing(before: Date, limit: number): Promise<readonly string[]> {
    return this.sessions.listStuckProcessing(before, limit)
  }

  async checkAnalysisAccess(sessionId: string, accountId: string): Promise<AnalysisAccess> {
    const readability = await this.sessions.checkReadability(sessionId, accountId)
    return { readable: readability.readable, failure: readability.failureReason }
  }
}

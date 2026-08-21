import type { SessionsPublicApi } from '@/modules/sessions/index.js'
import type { SessionsPort } from '@/modules/analyses/domain/ports/sessions-port/index.js'

export type SessionsProcessingContextReader = Pick<SessionsPublicApi, 'findProcessingContext'>
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
}

import type {
  FindSessionProcessingContextDependencies,
  FindSessionProcessingContextInput,
  SessionProcessingContext,
} from './types.js'

export class FindSessionProcessingContextUseCase {
  constructor(private readonly dependencies: FindSessionProcessingContextDependencies) {}
  async execute(
    input: FindSessionProcessingContextInput,
  ): Promise<SessionProcessingContext | null> {
    const session = await this.dependencies.sessions.findById(input.sessionId)
    if (session === null || session.audio === null || session.recordedAt === null) return null
    return {
      sessionId: session.id,
      accountId: session.accountId,
      themeId: session.themeId,
      audioPath: session.audio.storagePath,
      recordedAt: session.recordedAt,
    }
  }
}
export type { FindSessionProcessingContextInput, SessionProcessingContext } from './types.js'

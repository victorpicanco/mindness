import type { DownloadSessionAudioInput } from '@/modules/sessions/application/use-cases/download-session-audio/index.js'
import type {
  FindSessionProcessingContextInput,
  SessionProcessingContext,
} from '@/modules/sessions/application/use-cases/find-session-processing-context/index.js'
import type {
  ListStuckProcessingSessionsInput,
  ListStuckProcessingSessionsOutput,
} from '@/modules/sessions/application/use-cases/list-stuck-processing-sessions/index.js'

export interface SessionsPublicApi {
  findProcessingContext(sessionId: string): Promise<SessionProcessingContext | null>
  downloadAudio(sessionId: string): Promise<Buffer>
  listStuckProcessing(before: Date, limit: number): Promise<readonly string[]>
}
interface SessionsPublicApiDependencies {
  readonly findProcessingContext: {
    execute(input: FindSessionProcessingContextInput): Promise<SessionProcessingContext | null>
  }
  readonly downloadAudio: { execute(input: DownloadSessionAudioInput): Promise<Buffer> }
  readonly listStuckProcessing: {
    execute(input: ListStuckProcessingSessionsInput): Promise<ListStuckProcessingSessionsOutput>
  }
}
export class SessionsPublicApiImpl implements SessionsPublicApi {
  constructor(private readonly dependencies: SessionsPublicApiDependencies) {}

  findProcessingContext(sessionId: string): Promise<SessionProcessingContext | null> {
    return this.dependencies.findProcessingContext.execute({ sessionId })
  }

  downloadAudio(sessionId: string): Promise<Buffer> {
    return this.dependencies.downloadAudio.execute({ sessionId })
  }

  listStuckProcessing(before: Date, limit: number): Promise<readonly string[]> {
    return this.dependencies.listStuckProcessing.execute({ before, limit })
  }
}
export type { SessionProcessingContext }

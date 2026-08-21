import type { DownloadSessionAudioInput } from '@/modules/sessions/application/use-cases/download-session-audio/index.js'
import type {
  FindSessionProcessingContextInput,
  SessionProcessingContext,
} from '@/modules/sessions/application/use-cases/find-session-processing-context/index.js'

export interface SessionsPublicApi {
  findProcessingContext(sessionId: string): Promise<SessionProcessingContext | null>
  downloadAudio(sessionId: string): Promise<Buffer>
}
interface SessionsPublicApiDependencies {
  readonly findProcessingContext: {
    execute(input: FindSessionProcessingContextInput): Promise<SessionProcessingContext | null>
  }
  readonly downloadAudio: { execute(input: DownloadSessionAudioInput): Promise<Buffer> }
}
export class SessionsPublicApiImpl implements SessionsPublicApi {
  constructor(private readonly dependencies: SessionsPublicApiDependencies) {}

  findProcessingContext(sessionId: string): Promise<SessionProcessingContext | null> {
    return this.dependencies.findProcessingContext.execute({ sessionId })
  }

  downloadAudio(sessionId: string): Promise<Buffer> {
    return this.dependencies.downloadAudio.execute({ sessionId })
  }
}
export type { SessionProcessingContext }

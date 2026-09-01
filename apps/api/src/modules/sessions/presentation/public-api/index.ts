import type {
  CheckSessionReadabilityInput,
  CheckSessionReadabilityOutput,
} from '@/modules/sessions/application/use-cases/check-session-readability/index.js'
import type {
  DownloadSessionAudioInput,
  DownloadSessionAudioOutput,
} from '@/modules/sessions/application/use-cases/download-session-audio/index.js'
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
  downloadAudio(sessionId: string): Promise<DownloadSessionAudioOutput>
  listStuckProcessing(before: Date, limit: number): Promise<readonly string[]>
  checkReadability(sessionId: string, accountId: string): Promise<CheckSessionReadabilityOutput>
}
interface SessionsPublicApiDependencies {
  readonly findProcessingContext: {
    execute(input: FindSessionProcessingContextInput): Promise<SessionProcessingContext | null>
  }
  readonly downloadAudio: {
    execute(input: DownloadSessionAudioInput): Promise<DownloadSessionAudioOutput>
  }
  readonly listStuckProcessing: {
    execute(input: ListStuckProcessingSessionsInput): Promise<ListStuckProcessingSessionsOutput>
  }
  readonly checkReadability: {
    execute(input: CheckSessionReadabilityInput): Promise<CheckSessionReadabilityOutput>
  }
}
export class SessionsPublicApiImpl implements SessionsPublicApi {
  constructor(private readonly dependencies: SessionsPublicApiDependencies) {}

  findProcessingContext(sessionId: string): Promise<SessionProcessingContext | null> {
    return this.dependencies.findProcessingContext.execute({ sessionId })
  }

  downloadAudio(sessionId: string): Promise<DownloadSessionAudioOutput> {
    return this.dependencies.downloadAudio.execute({ sessionId })
  }

  listStuckProcessing(before: Date, limit: number): Promise<readonly string[]> {
    return this.dependencies.listStuckProcessing.execute({ before, limit })
  }

  checkReadability(sessionId: string, accountId: string): Promise<CheckSessionReadabilityOutput> {
    return this.dependencies.checkReadability.execute({ sessionId, accountId })
  }
}
export type { CheckSessionReadabilityOutput, DownloadSessionAudioOutput, SessionProcessingContext }

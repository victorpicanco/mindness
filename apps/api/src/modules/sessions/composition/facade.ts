import type { CheckSessionReadabilityUseCase } from '@/modules/sessions/application/use-cases/check-session-readability/index.js'
import type { DownloadSessionAudioUseCase } from '@/modules/sessions/application/use-cases/download-session-audio/index.js'
import type { FindSessionProcessingContextUseCase } from '@/modules/sessions/application/use-cases/find-session-processing-context/index.js'
import type { ListStuckProcessingSessionsUseCase } from '@/modules/sessions/application/use-cases/list-stuck-processing-sessions/index.js'
import {
  SessionsPublicApiImpl,
  type SessionsPublicApi,
} from '@/modules/sessions/presentation/public-api/index.js'

export function createSessionsFacade(dependencies: {
  readonly findProcessingContext: FindSessionProcessingContextUseCase
  readonly downloadAudio: DownloadSessionAudioUseCase
  readonly listStuckProcessing: ListStuckProcessingSessionsUseCase
  readonly checkReadability: CheckSessionReadabilityUseCase
}): SessionsPublicApi {
  return new SessionsPublicApiImpl(dependencies)
}

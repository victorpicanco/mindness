import type { PracticeSessionStatus } from './store'

export type PracticeSessionAction =
  | 'beginProcessing'
  | 'captureAudio'
  | 'discardAudio'
  | 'expireSession'
  | 'openRecordingWindow'
  | 'openRecording'
  | 'reset'
  | 'startResearching'

export class InvalidPracticeSessionTransitionError extends Error {
  readonly code = 'web.INVALID_PRACTICE_SESSION_TRANSITION'

  constructor(
    readonly fromStatus: PracticeSessionStatus,
    readonly attemptedAction: PracticeSessionAction,
  ) {
    super(`Cannot ${attemptedAction} from practice session status ${fromStatus}`)
    this.name = 'InvalidPracticeSessionTransitionError'
  }
}

export class PracticeSessionProviderMissingError extends Error {
  readonly code = 'web.PRACTICE_SESSION_PROVIDER_MISSING'

  constructor() {
    super('usePracticeSessionStore must be used within PracticeSessionProvider')
    this.name = 'PracticeSessionProviderMissingError'
  }
}

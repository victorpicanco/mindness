import { ConflictError } from '@/shared/errors/categories/conflict-error/index.js'

export class RecordingWindowNotOpenError extends ConflictError {
  readonly code = 'sessions.RECORDING_WINDOW_NOT_OPEN'

  constructor(researchEndsAt: Date) {
    super('Recording window is not open yet', {
      context: { researchEndsAt: researchEndsAt.toISOString() },
    })
  }
}

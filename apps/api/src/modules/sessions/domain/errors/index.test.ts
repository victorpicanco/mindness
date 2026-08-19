import { describe, expect, it } from 'vitest'

import { AudioSizeRejectedError } from '@/modules/sessions/domain/errors/audio-size-rejected-error/index.js'
import { AudioUploadFailedError } from '@/modules/sessions/domain/errors/audio-upload-failed-error/index.js'
import { AudioValidationRejectedError } from '@/modules/sessions/domain/errors/audio-validation-rejected-error/index.js'
import { SessionAlreadyRunningError } from '@/modules/sessions/domain/errors/session-already-running-error/index.js'
import { SessionAuthenticationRejectedError } from '@/modules/sessions/domain/errors/session-authentication-rejected-error/index.js'
import { SessionNotFoundError } from '@/modules/sessions/domain/errors/session-not-found-error/index.js'
import { SessionNotInProgressError } from '@/modules/sessions/domain/errors/session-not-in-progress-error/index.js'
import { ThemeUnavailableError } from '@/modules/sessions/domain/errors/theme-unavailable-error/index.js'
import { BaseError } from '@/shared/errors/base-error/index.js'

describe('session domain errors', () => {
  it.each([
    [
      new SessionAlreadyRunningError('session-1'),
      'sessions.SESSION_ALREADY_RUNNING',
      409,
      { sessionId: 'session-1' },
    ],
    [
      new SessionNotFoundError('session-1'),
      'sessions.SESSION_NOT_FOUND',
      404,
      { sessionId: 'session-1' },
    ],
    [
      new SessionNotInProgressError('processing'),
      'sessions.SESSION_NOT_IN_PROGRESS',
      409,
      { state: 'processing' },
    ],
    [
      new ThemeUnavailableError('mindfulness', 'easy'),
      'sessions.THEME_UNAVAILABLE',
      422,
      { categorySlug: 'mindfulness', difficulty: 'easy' },
    ],
    [
      new AudioSizeRejectedError(26_214_401),
      'sessions.AUDIO_SIZE_REJECTED',
      422,
      { sizeBytes: 26_214_401 },
    ],
    [
      new AudioValidationRejectedError('account-1/session-1/audio'),
      'sessions.AUDIO_VALIDATION_REJECTED',
      422,
      { storagePath: 'account-1/session-1/audio' },
    ],
    [
      new AudioUploadFailedError('account-1/session-1/audio'),
      'sessions.AUDIO_UPLOAD_FAILED',
      422,
      { storagePath: 'account-1/session-1/audio' },
    ],
    [new SessionAuthenticationRejectedError(), 'sessions.AUTHENTICATION_REJECTED', 401, {}],
  ])('has the expected code, HTTP status, and context', (error, code, httpStatus, context) => {
    expect(error).toBeInstanceOf(BaseError)
    expect(error.code).toBe(code)
    expect(error.httpStatus).toBe(httpStatus)
    expect(error.context).toEqual(context)
  })
})

import { describe, expect, it } from 'vitest'

import { TranscriptionFailedError } from './index.js'

describe('TranscriptionFailedError', () => {
  it('keeps the diagnostic in context', () => {
    const error = new TranscriptionFailedError('empty transcript')

    expect(error.code).toBe('analyses.TRANSCRIPTION_FAILED')
    expect(error.httpStatus).toBe(500)
    expect(error.context).toEqual({ reason: 'empty transcript' })
    expect(error.message).not.toContain('empty transcript')
  })
})

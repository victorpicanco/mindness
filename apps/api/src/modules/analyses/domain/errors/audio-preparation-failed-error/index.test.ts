import { describe, expect, it } from 'vitest'

import { InfrastructureError } from '@/shared/errors/infrastructure-error/index.js'

import { AudioPreparationFailedError } from './index.js'

describe('AudioPreparationFailedError', () => {
  it('keeps the diagnostic in context', () => {
    const error = new AudioPreparationFailedError('decoder exited with status 1')

    expect(error).toBeInstanceOf(InfrastructureError)
    expect(error.code).toBe('analyses.AUDIO_PREPARATION_FAILED')
    expect(error.httpStatus).toBe(500)
    expect(error.context).toEqual({ reason: 'decoder exited with status 1' })
    expect(error.message).not.toContain('decoder exited with status 1')
  })

  it('preserves the cause', () => {
    const cause = new TypeError('spawn ENOENT')

    expect(new AudioPreparationFailedError('binary missing', { cause }).cause).toBe(cause)
  })
})

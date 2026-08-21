import { describe, expect, it } from 'vitest'

import { EvaluationFailedError } from '@/modules/analyses/domain/errors/evaluation-failed-error/index.js'

import { InMemoryAudioReaderAdapter } from './index.js'

describe('InMemoryAudioReaderAdapter', () => {
  it('returns the configured audio for a session', async () => {
    const adapter = new InMemoryAudioReaderAdapter()
    const audio = Buffer.from('audio')
    adapter.setAudio('session-1', audio)

    await expect(adapter.read('session-1')).resolves.toEqual(audio)
  })

  it('fails the next audio read', async () => {
    const adapter = new InMemoryAudioReaderAdapter()
    adapter.failNext(new EvaluationFailedError('unavailable'))

    await expect(adapter.read('session-1')).rejects.toMatchObject({
      code: 'analyses.EVALUATION_FAILED',
    })
  })
})

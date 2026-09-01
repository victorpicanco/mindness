import { describe, expect, it } from 'vitest'

import { EvaluationFailedError } from '@/modules/analyses/domain/errors/evaluation-failed-error/index.js'

import { InMemoryAudioReaderAdapter } from './index.js'

describe('InMemoryAudioReaderAdapter', () => {
  it('returns the configured audio and its validated metadata', async () => {
    const adapter = new InMemoryAudioReaderAdapter()
    const bytes = Buffer.from('audio')
    adapter.setAudio('session-1', bytes, 'audio/mp4', 12.5)

    await expect(adapter.read('session-1')).resolves.toEqual({
      bytes,
      contentType: 'audio/mp4',
      durationSeconds: 12.5,
    })
  })

  it('reads an unset session as empty audio', async () => {
    const adapter = new InMemoryAudioReaderAdapter()

    await expect(adapter.read('session-1')).resolves.toMatchObject({ bytes: Buffer.alloc(0) })
  })

  it('fails the next audio read', async () => {
    const adapter = new InMemoryAudioReaderAdapter()
    adapter.failNext(new EvaluationFailedError('unavailable'))

    await expect(adapter.read('session-1')).rejects.toMatchObject({
      code: 'analyses.EVALUATION_FAILED',
    })
  })
})

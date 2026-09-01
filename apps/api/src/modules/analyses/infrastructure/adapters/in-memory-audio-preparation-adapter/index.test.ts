import { describe, expect, it } from 'vitest'

import { AudioPreparationFailedError } from '@/modules/analyses/domain/errors/audio-preparation-failed-error/index.js'

import { InMemoryAudioPreparationAdapter } from './index.js'

const source = {
  bytes: Buffer.from('original webm'),
  contentType: 'audio/webm',
  durationSeconds: 12.5,
}

describe('InMemoryAudioPreparationAdapter', () => {
  it('returns the configured canonical audio and records every preparation', async () => {
    const adapter = new InMemoryAudioPreparationAdapter()
    const controller = new AbortController()

    const prepared = await adapter.prepare({ source, signal: controller.signal })

    expect(prepared).toEqual({
      bytes: Buffer.from('flac'),
      contentType: 'audio/flac',
      durationSeconds: 12.5,
    })
    expect(adapter.received).toEqual([{ source, signal: controller.signal }])
  })

  it('counts how many preparations happened', async () => {
    const adapter = new InMemoryAudioPreparationAdapter()
    const controller = new AbortController()

    await adapter.prepare({ source, signal: controller.signal })
    await adapter.prepare({ source, signal: controller.signal })

    expect(adapter.received).toHaveLength(2)
  })

  it('returns the programmed canonical bytes', async () => {
    const adapter = new InMemoryAudioPreparationAdapter()
    adapter.setResult({
      bytes: Buffer.from('other flac'),
      contentType: 'audio/flac',
      durationSeconds: 3,
    })

    await expect(
      adapter.prepare({ source, signal: new AbortController().signal }),
    ).resolves.toEqual({
      bytes: Buffer.from('other flac'),
      contentType: 'audio/flac',
      durationSeconds: 3,
    })
  })

  it('fails the next preparation only once', async () => {
    const adapter = new InMemoryAudioPreparationAdapter()
    adapter.failNext(new AudioPreparationFailedError('decoder unavailable'))

    await expect(
      adapter.prepare({ source, signal: new AbortController().signal }),
    ).rejects.toMatchObject({ code: 'analyses.AUDIO_PREPARATION_FAILED' })
    await expect(
      adapter.prepare({ source, signal: new AbortController().signal }),
    ).resolves.toMatchObject({ contentType: 'audio/flac' })
  })

  it('waits until the signal aborts when it is programmed to hang', async () => {
    const adapter = new InMemoryAudioPreparationAdapter()
    const controller = new AbortController()
    adapter.hangUntilAborted()

    const pending = adapter.prepare({ source, signal: controller.signal })
    controller.abort()

    await expect(pending).rejects.toMatchObject({
      code: 'analyses.AUDIO_PREPARATION_FAILED',
      context: { reason: 'preparation aborted' },
    })
  })

  it('rejects immediately when the signal is already aborted', async () => {
    const adapter = new InMemoryAudioPreparationAdapter()
    const controller = new AbortController()
    controller.abort()
    adapter.hangUntilAborted()

    await expect(adapter.prepare({ source, signal: controller.signal })).rejects.toMatchObject({
      code: 'analyses.AUDIO_PREPARATION_FAILED',
    })
  })

  it('forgets the recorded preparations when it is reset', async () => {
    const adapter = new InMemoryAudioPreparationAdapter()
    const controller = new AbortController()
    await adapter.prepare({ source, signal: controller.signal })

    adapter.reset()

    expect(adapter.received).toHaveLength(0)
  })
})

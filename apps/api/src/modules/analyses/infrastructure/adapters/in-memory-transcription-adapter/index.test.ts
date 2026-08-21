import { describe, expect, it } from 'vitest'

import { EvaluationFailedError } from '@/modules/analyses/domain/errors/evaluation-failed-error/index.js'

import { InMemoryTranscriptionAdapter } from './index.js'

const result = {
  text: 'Uma transcrição de teste.',
  words: [{ word: 'Uma', start: 0, end: 0.2, confidence: 0.98 }],
  averageConfidence: 0.98,
  durationSeconds: 1,
}

describe('InMemoryTranscriptionAdapter', () => {
  it('returns its configured transcription and records the input', async () => {
    const adapter = new InMemoryTranscriptionAdapter(result)
    const controller = new AbortController()
    const input = { audio: Buffer.from('audio'), deadlineMs: 500, signal: controller.signal }

    await expect(adapter.transcribe(input)).resolves.toEqual(result)
    expect(adapter.received).toEqual([input])
  })

  it('fails the next transcription', async () => {
    const adapter = new InMemoryTranscriptionAdapter(result)
    const controller = new AbortController()
    adapter.failNext(new EvaluationFailedError('unavailable'))

    await expect(
      adapter.transcribe({
        audio: Buffer.from('audio'),
        deadlineMs: 500,
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ code: 'analyses.EVALUATION_FAILED' })
  })

  it('waits until the signal is aborted', async () => {
    const adapter = new InMemoryTranscriptionAdapter(result)
    const controller = new AbortController()
    adapter.hangUntilAborted()
    const transcription = adapter.transcribe({
      audio: Buffer.from('audio'),
      deadlineMs: 500,
      signal: controller.signal,
    })
    controller.abort()

    await expect(transcription).rejects.toMatchObject({
      code: 'analyses.ANALYSIS_DEADLINE_EXCEEDED',
    })
  })
})

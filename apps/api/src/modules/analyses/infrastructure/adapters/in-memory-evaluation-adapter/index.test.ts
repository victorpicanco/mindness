import { describe, expect, it } from 'vitest'

import { EvaluationFailedError } from '@/modules/analyses/domain/errors/evaluation-failed-error/index.js'
import { RhythmMetrics } from '@/modules/analyses/domain/value-objects/rhythm-metrics/index.js'

import { InMemoryEvaluationAdapter } from './index.js'

const result = {
  clarityScore: 82,
  clarityGuidance: 'Sua explicação ficou clara e bem organizada.',
  fluencyScore: 75,
  fluencyGuidance: 'Mantenha frases curtas para ganhar fluidez.',
  masteryScore: 91,
  masteryGuidance: 'Você demonstrou domínio consistente do assunto.',
  inputTokens: 123,
  outputTokens: 45,
}

const rhythm = RhythmMetrics.create({
  wordsPerMinute: 145,
  wordCount: 12,
  speechDurationSeconds: 5,
  pauseCount: 2,
  longPauseCount: 0,
  longestPauseSeconds: 0.5,
})

function createInput(signal: AbortSignal) {
  return { themeTitle: 'Tema', transcript: 'Transcrição', rhythm, signal }
}

describe('InMemoryEvaluationAdapter', () => {
  it('returns its configured evaluation and records the input', async () => {
    const adapter = new InMemoryEvaluationAdapter(result)
    const controller = new AbortController()
    const input = createInput(controller.signal)

    await expect(adapter.evaluate(input)).resolves.toEqual(result)
    expect(adapter.received).toEqual([input])
  })

  it('fails the next evaluation', async () => {
    const adapter = new InMemoryEvaluationAdapter(result)
    const controller = new AbortController()
    adapter.failNext(new EvaluationFailedError('unavailable'))

    await expect(adapter.evaluate(createInput(controller.signal))).rejects.toMatchObject({
      code: 'analyses.EVALUATION_FAILED',
    })
  })

  it('waits until the signal is aborted', async () => {
    const adapter = new InMemoryEvaluationAdapter(result)
    const controller = new AbortController()
    adapter.hangUntilAborted()
    const evaluation = adapter.evaluate(createInput(controller.signal))
    controller.abort()

    await expect(evaluation).rejects.toMatchObject({ code: 'analyses.ANALYSIS_DEADLINE_EXCEEDED' })
  })

  it('validates a configured provider payload with the production parser', async () => {
    const adapter = new InMemoryEvaluationAdapter(result)
    const controller = new AbortController()
    adapter.respondWith({ ...result, clarityScore: 101 })

    await expect(adapter.evaluate(createInput(controller.signal))).rejects.toMatchObject({
      code: 'analyses.MALFORMED_EVALUATION',
    })
  })
})

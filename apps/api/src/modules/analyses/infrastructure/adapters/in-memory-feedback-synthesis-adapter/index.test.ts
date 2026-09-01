import { describe, expect, it } from 'vitest'

import { FeedbackSynthesisFailedError } from '@/modules/analyses/domain/errors/feedback-synthesis-failed-error/index.js'
import { MalformedEvaluationError } from '@/modules/analyses/domain/errors/malformed-evaluation-error/index.js'
import type { PreparedAudio } from '@/modules/analyses/domain/ports/audio-preparation-port/index.js'
import type { AuditoryObservation } from '@/modules/analyses/domain/ports/auditory-analysis-port/index.js'
import type { FeedbackSynthesisInput } from '@/modules/analyses/domain/ports/feedback-synthesis-port/index.js'
import { CommunicationFeedback } from '@/modules/analyses/domain/value-objects/communication-feedback/index.js'
import { RhythmMetrics } from '@/modules/analyses/domain/value-objects/rhythm-metrics/index.js'

import { InMemoryFeedbackSynthesisAdapter } from './index.js'

const audio: PreparedAudio = {
  bytes: Buffer.from('flac'),
  contentType: 'audio/flac',
  durationSeconds: 12.5,
}

const observation: AuditoryObservation = {
  audioUsability: 'usable',
  limitations: [],
  literalTranscript: 'ééé então eu acho que',
  mainMessage: 'A pessoa apresenta uma ideia.',
  attemptedStructure: 'Abertura e fechamento.',
  deliverySummary: 'Ritmo irregular com hesitações.',
  candidateEvents: [],
}

const feedbackPayload = {
  audioUsability: 'usable',
  alignmentQuality: 'reliable',
  limitations: [],
  literalTranscript: 'ééé então eu acho que',
  mainMessage: 'A pessoa defende uma ideia com um exemplo.',
  attemptedStructure: 'Abertura, exemplo e fechamento.',
  summary: 'A mensagem chega inteira. O início hesita antes do primeiro argumento.',
  strengths: [],
  moments: [],
  patterns: [],
  asrDivergences: [],
  priorities: [],
}

const feedback = CommunicationFeedback.create({
  durationSeconds: audio.durationSeconds,
  ...feedbackPayload,
  audioUsability: 'usable',
  alignmentQuality: 'reliable',
})

const result = { feedback, inputTokens: 1_500, outputTokens: 650 }

function createInput(signal: AbortSignal): FeedbackSynthesisInput {
  return {
    audio,
    observation,
    themeTitle: 'Trabalho remoto',
    transcript: 'Então eu acho que o ponto principal é este.',
    words: [{ word: 'Então', start: 0.5, end: 1, confidence: 0.98 }],
    rhythm: RhythmMetrics.create({
      wordsPerMinute: 132,
      wordCount: 20,
      speechDurationSeconds: 10,
      pauseCount: 2,
      longPauseCount: 0,
      longestPauseSeconds: 0.4,
    }),
    signal,
  }
}

function createAdapter(): InMemoryFeedbackSynthesisAdapter {
  return new InMemoryFeedbackSynthesisAdapter(result)
}

describe('InMemoryFeedbackSynthesisAdapter', () => {
  it('records every call and returns the configured feedback', async () => {
    const adapter = createAdapter()
    const input = createInput(new AbortController().signal)

    await expect(adapter.synthesize(input)).resolves.toEqual(result)
    expect(adapter.received).toEqual([input])
  })

  it('returns a programmed payload validated by the synthesis parser', async () => {
    const adapter = createAdapter()
    adapter.respondWith({
      ...feedbackPayload,
      mainMessage: 'A pessoa defende o trabalho remoto.',
    })

    const synthesized = await adapter.synthesize(createInput(new AbortController().signal))

    expect(synthesized.feedback).toBeInstanceOf(CommunicationFeedback)
    expect(synthesized.feedback.mainMessage).toBe('A pessoa defende o trabalho remoto.')
    expect(synthesized.feedback.durationSeconds).toBe(audio.durationSeconds)
    expect(synthesized.inputTokens).toBe(1_500)
    expect(synthesized.outputTokens).toBe(650)
  })

  it('rejects a programmed payload carrying a score', async () => {
    const adapter = createAdapter()
    adapter.respondWith({ ...feedbackPayload, clarityScore: 80 })

    await expect(
      adapter.synthesize(createInput(new AbortController().signal)),
    ).rejects.toBeInstanceOf(MalformedEvaluationError)
  })

  it('fails the next call only once', async () => {
    const adapter = createAdapter()
    adapter.failNext(new FeedbackSynthesisFailedError('provider unavailable'))

    await expect(
      adapter.synthesize(createInput(new AbortController().signal)),
    ).rejects.toMatchObject({ code: 'analyses.FEEDBACK_SYNTHESIS_FAILED' })
    await expect(adapter.synthesize(createInput(new AbortController().signal))).resolves.toEqual(
      result,
    )
  })

  it('answers only after the programmed latency', async () => {
    const adapter = createAdapter()
    adapter.delayNext(10)
    let settled = false

    const pending = adapter.synthesize(createInput(new AbortController().signal)).then((value) => {
      settled = true
      return value
    })

    expect(settled).toBe(false)
    await expect(pending).resolves.toEqual(result)
    expect(settled).toBe(true)
  })

  it('waits until the signal aborts when it is programmed to hang', async () => {
    const adapter = createAdapter()
    const controller = new AbortController()
    adapter.hangUntilAborted()

    const pending = adapter.synthesize(createInput(controller.signal))
    controller.abort()

    await expect(pending).rejects.toMatchObject({
      code: 'analyses.FEEDBACK_SYNTHESIS_FAILED',
      context: { reason: 'request aborted' },
    })
  })

  it('forgets every simulation on reset', async () => {
    const adapter = createAdapter()
    adapter.respondWith({ ...feedbackPayload, clarityScore: 80 })
    adapter.hangUntilAborted()
    adapter.reset()

    await expect(adapter.synthesize(createInput(new AbortController().signal))).resolves.toEqual(
      result,
    )
  })
})

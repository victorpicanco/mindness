import { describe, expect, it } from 'vitest'

import { AuditoryAnalysisFailedError } from '@/modules/analyses/domain/errors/auditory-analysis-failed-error/index.js'
import { MalformedAuditoryAnalysisError } from '@/modules/analyses/domain/errors/malformed-auditory-analysis-error/index.js'
import type { AuditoryAnalysisResult } from '@/modules/analyses/domain/ports/auditory-analysis-port/index.js'
import type { PreparedAudio } from '@/modules/analyses/domain/ports/audio-preparation-port/index.js'

import { InMemoryAuditoryAnalysisAdapter } from './index.js'

const audio: PreparedAudio = {
  bytes: Buffer.from('flac'),
  contentType: 'audio/flac',
  durationSeconds: 12.5,
}

const result: AuditoryAnalysisResult = {
  observation: {
    audioUsability: 'usable',
    limitations: [],
    literalTranscript: 'ééé então eu acho que',
    mainMessage: 'A pessoa apresenta uma ideia.',
    attemptedStructure: 'Abertura e fechamento.',
    deliverySummary: 'Ritmo irregular com hesitações.',
    candidateEvents: [],
  },
  inputTokens: 900,
  outputTokens: 120,
}

function createAdapter(): InMemoryAuditoryAnalysisAdapter {
  return new InMemoryAuditoryAnalysisAdapter(result)
}

describe('InMemoryAuditoryAnalysisAdapter', () => {
  it('records every call and returns the configured observation', async () => {
    const adapter = createAdapter()
    const controller = new AbortController()

    await expect(adapter.observe({ audio, signal: controller.signal })).resolves.toEqual(result)
    expect(adapter.received).toEqual([{ audio, signal: controller.signal }])
  })

  it('returns a programmed payload validated by the auditory parser', async () => {
    const adapter = createAdapter()
    adapter.respondWith({
      ...result.observation,
      candidateEvents: [
        {
          startSeconds: 1,
          endSeconds: 1.5,
          excerpt: 'ééé',
          category: 'filler',
          auditoryEvidence: 'Vogal sustentada antes da frase.',
          confidence: 'medium',
        },
      ],
    })

    const observed = await adapter.observe({ audio, signal: new AbortController().signal })

    expect(observed.observation.candidateEvents).toHaveLength(1)
    expect(observed.inputTokens).toBe(900)
    expect(observed.outputTokens).toBe(120)
  })

  it('rejects a programmed payload that breaks the intermediate contract', async () => {
    const adapter = createAdapter()
    adapter.respondWith({ ...result.observation, audioUsability: 'excellent' })

    await expect(
      adapter.observe({ audio, signal: new AbortController().signal }),
    ).rejects.toBeInstanceOf(MalformedAuditoryAnalysisError)
  })

  it('fails the next call only once', async () => {
    const adapter = createAdapter()
    adapter.failNext(new AuditoryAnalysisFailedError('provider unavailable'))

    await expect(
      adapter.observe({ audio, signal: new AbortController().signal }),
    ).rejects.toMatchObject({ code: 'analyses.AUDITORY_ANALYSIS_FAILED' })
    await expect(adapter.observe({ audio, signal: new AbortController().signal })).resolves.toEqual(
      result,
    )
  })

  it('answers only after the programmed latency', async () => {
    const adapter = createAdapter()
    adapter.delayNext(10)
    let settled = false

    const pending = adapter
      .observe({ audio, signal: new AbortController().signal })
      .then((value) => {
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

    const pending = adapter.observe({ audio, signal: controller.signal })
    controller.abort()

    await expect(pending).rejects.toMatchObject({
      code: 'analyses.AUDITORY_ANALYSIS_FAILED',
      context: { reason: 'request aborted' },
    })
  })

  it('forgets every simulation on reset', async () => {
    const adapter = createAdapter()
    adapter.respondWith({ ...result.observation, audioUsability: 'excellent' })
    adapter.hangUntilAborted()
    adapter.reset()

    await expect(adapter.observe({ audio, signal: new AbortController().signal })).resolves.toEqual(
      result,
    )
  })
})

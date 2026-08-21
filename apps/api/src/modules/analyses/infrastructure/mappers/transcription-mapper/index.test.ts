import { describe, expect, it } from 'vitest'

import { Transcription } from '@/modules/analyses/domain/entities/transcription/index.js'

import { TranscriptionMapper } from './index.js'

const row = {
  id: 'transcription-id',
  sessionId: 'session-id',
  text: 'Olá mundo',
  words: [{ word: 'Olá', start: 0, end: 0.4, confidence: 0.99 }],
  averageConfidence: 0.99,
  durationSeconds: 1,
  createdAt: new Date('2026-08-21T12:00:00.000Z'),
}

describe('TranscriptionMapper', () => {
  it('maps persisted JSON words to and from the domain without loss', () => {
    const mapper = new TranscriptionMapper()
    const transcription = mapper.toDomain(row)

    expect(transcription).toBeInstanceOf(Transcription)
    expect(mapper.toData(transcription)).toEqual(row)
  })

  it('preserves the fractional audio duration Deepgram measures', () => {
    const mapper = new TranscriptionMapper()
    const fractionalRow = { ...row, durationSeconds: 62.34 }

    const transcription = mapper.toDomain(fractionalRow)

    expect(transcription.durationSeconds).toBe(62.34)
    expect(mapper.toData(transcription).durationSeconds).toBe(62.34)
  })
})

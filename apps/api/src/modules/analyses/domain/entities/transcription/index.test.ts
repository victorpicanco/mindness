import { describe, expect, it } from 'vitest'

import { Transcription } from './index.js'

const CREATED_AT = new Date('2026-08-21T12:00:00.000Z')
const WORDS = [
  { word: 'Hello', start: 0, end: 0.4, confidence: 0.9 },
  { word: 'world', start: 0.5, end: 1, confidence: 0.7 },
]

describe('Transcription', () => {
  it('creates a transcription retaining its timestamped words and external duration', () => {
    const transcription = Transcription.create({
      transcriptionId: 'transcription-id',
      sessionId: 'session-id',
      text: 'Hello world',
      words: WORDS,
      durationSeconds: 42,
      createdAt: CREATED_AT,
    })

    expect(transcription.id).toBe('transcription-id')
    expect(transcription.sessionId).toBe('session-id')
    expect(transcription.text).toBe('Hello world')
    expect(transcription.words).toEqual(WORDS)
    expect(transcription.averageConfidence).toBeCloseTo(0.8)
    expect(transcription.durationSeconds).toBe(42)
    expect(transcription.createdAt).toEqual(CREATED_AT)
  })

  it('does not produce NaN average confidence when there are no words', () => {
    const transcription = Transcription.create({
      transcriptionId: 'transcription-id',
      sessionId: 'session-id',
      text: '',
      words: [],
      durationSeconds: 0,
      createdAt: CREATED_AT,
    })

    expect(transcription.averageConfidence).toBe(0)
  })

  it('reconstitutes every persisted transcription field', () => {
    const transcription = Transcription.reconstitute({
      transcriptionId: 'transcription-id',
      sessionId: 'session-id',
      text: 'Hello world',
      words: WORDS,
      averageConfidence: 0.42,
      durationSeconds: 99,
      createdAt: CREATED_AT,
    })

    expect(transcription.words).toEqual(WORDS)
    expect(transcription.averageConfidence).toBe(0.42)
    expect(transcription.durationSeconds).toBe(99)
    expect(transcription.createdAt).toEqual(CREATED_AT)
  })
})

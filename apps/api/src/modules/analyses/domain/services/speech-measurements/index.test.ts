import { describe, expect, it } from 'vitest'

import { SpeechMeasurements } from './index.js'

describe('SpeechMeasurements', () => {
  it('includes silence in recording rate and assigns words to non-overlapping ten-second windows', () => {
    const words = [0, 9.9, 10, 20].map((start) => ({
      word: 'word',
      start,
      end: start + 0.1,
      confidence: 1,
    }))

    expect(SpeechMeasurements.rhythm(words, 25)).toEqual({
      durationSeconds: 25,
      wordCount: 4,
      wordsPerMinute: 10,
      windows: [
        { startSeconds: 0, endSeconds: 10, wordCount: 2, wordsPerMinute: 12 },
        { startSeconds: 10, endSeconds: 20, wordCount: 1, wordsPerMinute: 6 },
        { startSeconds: 20, endSeconds: 25, wordCount: 1, wordsPerMinute: 12 },
      ],
    })
  })

  it('reports unavailable rate for an empty transcript instead of diagnosing slow speech', () => {
    expect(SpeechMeasurements.rhythm([], 60)).toMatchObject({
      wordCount: 0,
      wordsPerMinute: null,
      windows: [],
    })
  })

  it('counts contextual occurrences rather than matching every lexical word', () => {
    const occurrences = [
      {
        expression: 'é',
        startSeconds: 1,
        endSeconds: 1.4,
        quote: 'é... the proposal',
        confidence: 'high' as const,
      },
      {
        expression: 'é',
        startSeconds: 8,
        endSeconds: 8.4,
        quote: 'é... the benefit',
        confidence: 'high' as const,
      },
      {
        expression: 'tipo',
        startSeconds: 20,
        endSeconds: 20.5,
        quote: 'tipo... it works',
        confidence: 'medium' as const,
      },
    ]
    expect(SpeechMeasurements.fillers('partial', occurrences, 30)).toEqual({
      status: 'partial',
      total: 3,
      perMinute: 6,
      byExpression: [
        { expression: 'é', count: 2 },
        { expression: 'tipo', count: 1 },
      ],
      occurrences,
    })
  })

  it('distinguishes no detected fillers from an unavailable assessment', () => {
    expect(SpeechMeasurements.fillers('assessed', [], 60)).toMatchObject({ total: 0, perMinute: 0 })
    expect(SpeechMeasurements.fillers('unavailable', [], 60)).toMatchObject({
      total: null,
      perMinute: null,
    })
  })
})

import { describe, expect, it } from 'vitest'

import { BestOfDayResolver } from './index.js'

describe('BestOfDayResolver', () => {
  it('selects only the highest score for a local day', () => {
    expect(
      BestOfDayResolver.resolve(
        [
          candidate('first', 70, '2026-08-22T12:00:00.000Z'),
          candidate('best', 90, '2026-08-22T14:00:00.000Z'),
        ],
        'America/Sao_Paulo',
      ),
    ).toEqual(new Set(['best']))
  })

  it('selects a single session on a local day', () => {
    expect(
      BestOfDayResolver.resolve(
        [candidate('only', 70, '2026-08-22T12:00:00.000Z')],
        'America/Sao_Paulo',
      ),
    ).toEqual(new Set(['only']))
  })

  it('prefers the earliest session when scores tie', () => {
    expect(
      BestOfDayResolver.resolve(
        [
          candidate('later', 90, '2026-08-22T14:00:00.000Z'),
          candidate('earlier', 90, '2026-08-22T12:00:00.000Z'),
        ],
        'America/Sao_Paulo',
      ),
    ).toEqual(new Set(['earlier']))
  })

  it('prefers the smaller session ID when score and time tie', () => {
    expect(
      BestOfDayResolver.resolve(
        [
          candidate('b-session', 90, '2026-08-22T12:00:00.000Z'),
          candidate('a-session', 90, '2026-08-22T12:00:00.000Z'),
        ],
        'America/Sao_Paulo',
      ),
    ).toEqual(new Set(['a-session']))
  })

  it('selects winners across different local days', () => {
    expect(
      BestOfDayResolver.resolve(
        [
          candidate('first', 70, '2026-08-22T02:00:00.000Z'),
          candidate('second', 90, '2026-08-22T03:30:00.000Z'),
        ],
        'America/Sao_Paulo',
      ),
    ).toEqual(new Set(['first', 'second']))
  })

  it('separates sessions around local midnight', () => {
    expect(
      BestOfDayResolver.resolve(
        [
          candidate('before', 90, '2026-08-22T02:00:00.000Z'),
          candidate('after', 70, '2026-08-22T05:00:00.000Z'),
        ],
        'America/Sao_Paulo',
      ),
    ).toEqual(new Set(['before', 'after']))
  })

  it('returns an empty set for no candidates', () => {
    expect(BestOfDayResolver.resolve([], 'America/Sao_Paulo')).toEqual(new Set())
  })
})

function candidate(sessionId: string, totalScore: number, createdAt: string) {
  return { sessionId, totalScore, createdAt: new Date(createdAt) }
}

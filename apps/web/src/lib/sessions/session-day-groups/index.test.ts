import { describe, expect, it } from 'vitest'

import type { SessionHistoryItem } from '@/lib/api/contracts/sessions'

import { groupSessionsByDay } from './index'

function createSession(overrides: Partial<SessionHistoryItem> = {}): SessionHistoryItem {
  return {
    bestOfDay: false,
    categorySlug: 'focus',
    difficulty: 'balanced',
    localDate: '2026-08-25',
    localTime: '09:00',
    sessionId: '7d5f46c9-3cbd-4c6d-84aa-66b8148a91aa',
    startedAt: '2026-08-25T12:00:00.000Z',
    state: 'completed',
    themeTitle: 'Notícias do dia',
    totalScore: 70,
    ...overrides,
  }
}

const NOW = new Date('2026-08-25T12:00:00.000Z')

describe('groupSessionsByDay', () => {
  it('heads the group of the current local day as today', () => {
    const groups = groupSessionsByDay({
      now: NOW,
      sessions: [createSession()],
      timeZone: 'America/Sao_Paulo',
    })

    expect(groups).toEqual([
      {
        localDate: '2026-08-25',
        heading: { kind: 'today' },
        items: [
          {
            sessionId: '7d5f46c9-3cbd-4c6d-84aa-66b8148a91aa',
            href: '/sessions/7d5f46c9-3cbd-4c6d-84aa-66b8148a91aa',
            title: 'Notícias do dia',
          },
        ],
      },
    ])
  })

  it('heads the previous local day as yesterday and older days as a day-first date', () => {
    const groups = groupSessionsByDay({
      now: NOW,
      sessions: [
        createSession({ sessionId: 'session-1', localDate: '2026-08-24' }),
        createSession({ sessionId: 'session-2', localDate: '2026-08-01' }),
      ],
      timeZone: 'America/Sao_Paulo',
    })

    expect(groups.map((group) => group.heading)).toEqual([
      { kind: 'yesterday' },
      { kind: 'date', value: '01/08/2026' },
    ])
  })

  it('reads the current day in the account time zone, not in the runtime one', () => {
    const groups = groupSessionsByDay({
      now: new Date('2026-08-25T02:00:00.000Z'),
      sessions: [createSession({ localDate: '2026-08-24' })],
      timeZone: 'America/Sao_Paulo',
    })

    expect(groups.map((group) => group.heading)).toEqual([{ kind: 'today' }])
  })

  it('keeps the received order and collects every session of the same day under one heading', () => {
    const groups = groupSessionsByDay({
      now: NOW,
      sessions: [
        createSession({ sessionId: 'session-1', localDate: '2026-08-25' }),
        createSession({ sessionId: 'session-2', localDate: '2026-08-24' }),
        createSession({ sessionId: 'session-3', localDate: '2026-08-24' }),
      ],
      timeZone: 'America/Sao_Paulo',
    })

    expect(groups.map((group) => group.items.map((item) => item.sessionId))).toEqual([
      ['session-1'],
      ['session-2', 'session-3'],
    ])
  })

  it('leaves the title empty when the session no longer resolves a theme', () => {
    const groups = groupSessionsByDay({
      now: NOW,
      sessions: [createSession({ themeTitle: null })],
      timeZone: 'America/Sao_Paulo',
    })

    expect(groups[0]?.items[0]?.title).toBeNull()
  })

  it('returns no group for an empty history', () => {
    expect(groupSessionsByDay({ now: NOW, sessions: [], timeZone: 'UTC' })).toEqual([])
  })
})

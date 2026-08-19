import { describe, expect, it } from 'vitest'

import { Session } from '@/modules/sessions/domain/entities/session/index.js'
import type { SessionRow } from '@/modules/sessions/infrastructure/clients/sessions-prisma-client/index.js'

import { SessionMapper } from './index.js'

const row: SessionRow = {
  id: '6f3a143d-6853-48f0-b414-a57d8b65f101',
  accountId: '97784f56-9b46-44a4-a0d2-52e97d2fe201',
  themeId: 'c674e9e3-807e-4516-8471-43b0c392f701',
  difficulty: 'balanced',
  categorySlug: 'self-awareness',
  searchWindowMinutes: 4,
  quotaReservationId: '5ad7c104-4621-4a0f-906b-e5a2ca616601',
  state: 'processing',
  expiredReason: null,
  createdAt: new Date('2026-08-19T12:00:00.000Z'),
  expiresAt: new Date('2026-08-19T12:15:00.000Z'),
  expiredAt: null,
  audio: {
    id: '6f3a143d-6853-48f0-b414-a57d8b65f101',
    sessionId: '6f3a143d-6853-48f0-b414-a57d8b65f101',
    durationSeconds: 42,
    sizeBytes: 1024,
    contentType: 'audio/webm',
    storagePath: '97784f56-9b46-44a4-a0d2-52e97d2fe201/6f3a143d-6853-48f0-b414-a57d8b65f101/audio',
    createdAt: new Date('2026-08-19T12:00:00.000Z'),
  },
}

describe('SessionMapper', () => {
  it('reconstitutes a persisted session including its related audio', () => {
    const session = new SessionMapper().toDomain(row)

    expect(session).toBeInstanceOf(Session)
    expect(session).toMatchObject({
      id: row.id,
      accountId: row.accountId,
      themeId: row.themeId,
      quotaReservationId: row.quotaReservationId,
      state: row.state,
      expiredReason: row.expiredReason,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
      expiredAt: row.expiredAt,
    })
    expect(session.configuration).toMatchObject({
      difficulty: row.difficulty,
      categorySlug: row.categorySlug,
      searchWindowMinutes: row.searchWindowMinutes,
    })
    expect(session.audio).toMatchObject({
      durationSeconds: row.audio?.durationSeconds,
      sizeBytes: row.audio?.sizeBytes,
      contentType: row.audio?.contentType,
      storagePath: row.audio?.storagePath,
    })
  })

  it('maps a session back to its persistence row without losing its audio', () => {
    const mapper = new SessionMapper()

    expect(mapper.toPersistence(mapper.toDomain(row))).toEqual(row)
  })
})

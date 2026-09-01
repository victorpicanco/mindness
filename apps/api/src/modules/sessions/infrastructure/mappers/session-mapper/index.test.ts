import { describe, expect, it } from 'vitest'

import { Session } from '@/modules/sessions/domain/entities/session/index.js'
import type { SessionRow } from '@/modules/sessions/infrastructure/clients/sessions-prisma-client/index.js'
import { SessionAudioMapper } from '@/modules/sessions/infrastructure/mappers/session-audio-mapper/index.js'

import { SessionMapper } from './index.js'

const AUDIO_ID = '2c3d0f4e-9a1b-4c5d-8e6f-0a1b2c3d4e5f'
const row: SessionRow = {
  id: '6f3a143d-6853-48f0-b414-a57d8b65f101',
  accountId: '97784f56-9b46-44a4-a0d2-52e97d2fe201',
  themeId: 'c674e9e3-807e-4516-8471-43b0c392f701',
  difficulty: 'balanced',
  categorySlug: 'self-awareness',
  searchWindowMinutes: 4,
  state: 'processing',
  expiredReason: null,
  failureReason: 'analysis_failed',
  createdAt: new Date('2026-08-19T12:00:00.000Z'),
  expiresAt: new Date('2026-08-19T12:15:00.000Z'),
  expiredAt: null,
  recordingStartedAt: new Date('2026-08-19T12:03:00.000Z'),
  recordedAt: new Date('2026-08-19T12:04:00.000Z'),
  totalScore: 86,
  completedAt: null,
  failedAt: new Date('2026-08-19T12:09:00.000Z'),
  audio: {
    id: AUDIO_ID,
    sessionId: '6f3a143d-6853-48f0-b414-a57d8b65f101',
    durationSeconds: 42,
    sizeBytes: 1024,
    contentType: 'audio/webm',
    storagePath: '97784f56-9b46-44a4-a0d2-52e97d2fe201/6f3a143d-6853-48f0-b414-a57d8b65f101/audio',
    createdAt: new Date('2026-08-19T12:00:00.000Z'),
  },
}

function createMapper(): SessionMapper {
  return new SessionMapper(new SessionAudioMapper())
}

describe('SessionMapper', () => {
  it('reconstitutes a persisted session including its related audio', () => {
    const session = createMapper().toDomain(row)

    expect(session).toBeInstanceOf(Session)
    expect(session).toMatchObject({
      id: row.id,
      accountId: row.accountId,
      themeId: row.themeId,
      state: row.state,
      expiredReason: row.expiredReason,
      failureReason: row.failureReason,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
      expiredAt: row.expiredAt,
      recordingStartedAt: row.recordingStartedAt,
      recordedAt: row.recordedAt,
      totalScore: row.totalScore,
      completedAt: row.completedAt,
      failedAt: row.failedAt,
    })
    expect(session.configuration).toMatchObject({
      difficulty: row.difficulty,
      categorySlug: row.categorySlug,
      searchWindowMinutes: row.searchWindowMinutes,
    })
    expect(session.audio).toMatchObject({
      id: AUDIO_ID,
      durationSeconds: row.audio?.durationSeconds,
      sizeBytes: row.audio?.sizeBytes,
      contentType: row.audio?.contentType,
      storagePath: row.audio?.storagePath,
    })
  })

  it('maps a session to a create payload that carries the related audio', () => {
    const mapper = createMapper()

    const created = mapper.toCreateData(mapper.toDomain(row))

    expect(created).toMatchObject({
      id: row.id,
      accountId: row.accountId,
      difficulty: row.difficulty,
      categorySlug: row.categorySlug,
      searchWindowMinutes: row.searchWindowMinutes,
      state: row.state,
      failureReason: row.failureReason,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
      recordingStartedAt: row.recordingStartedAt,
      recordedAt: row.recordedAt,
      totalScore: row.totalScore,
      completedAt: row.completedAt,
      failedAt: row.failedAt,
    })
    expect(created.audio).toEqual({
      create: {
        id: AUDIO_ID,
        durationSeconds: 42,
        sizeBytes: 1024,
        contentType: 'audio/webm',
        storagePath: row.audio?.storagePath,
        createdAt: row.createdAt,
      },
    })
  })

  it('maps a session to an update payload that upserts the related audio', () => {
    const mapper = createMapper()

    const updated = mapper.toUpdateData(mapper.toDomain(row))

    expect(updated.audio?.upsert.create.id).toBe(AUDIO_ID)
    expect(updated.audio?.upsert.update).toEqual({
      durationSeconds: 42,
      sizeBytes: 1024,
      contentType: 'audio/webm',
      storagePath: row.audio?.storagePath,
    })
  })

  it('omits the audio payload entirely for a session that has none', () => {
    const mapper = createMapper()
    const session = mapper.toDomain({ ...row, state: 'in_progress', audio: null })

    expect(mapper.toCreateData(session).audio).toBeUndefined()
    expect(mapper.toUpdateData(session).audio).toBeUndefined()
  })

  it('gives the audio row its own identity rather than reusing the session id', () => {
    const session = createMapper().toDomain(row)

    expect(session.audio?.id).toBe(AUDIO_ID)
    expect(session.audio?.id).not.toBe(session.id)
  })

  it('preserves when a deleted session was deleted while mapping it to and from persistence', () => {
    const deletedAt = new Date('2026-08-19T12:10:00.000Z')
    const mapper = createMapper()
    const session = mapper.toDomain({ ...row, state: 'deleted', deletedAt })

    expect(session.deletedAt).toEqual(deletedAt)
    expect(mapper.toCreateData(session).deletedAt).toEqual(deletedAt)
    expect(mapper.toUpdateData(session).deletedAt).toEqual(deletedAt)
  })

  it('maps a session that was never deleted with a null deletedAt value', () => {
    const mapper = createMapper()
    const session = mapper.toDomain(row)

    expect(session.deletedAt).toBeNull()
    expect(mapper.toCreateData(session).deletedAt).toBeNull()
  })
})

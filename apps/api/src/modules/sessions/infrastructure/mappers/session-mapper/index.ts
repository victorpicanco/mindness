import { Session } from '@/modules/sessions/domain/entities/session/index.js'
import { SessionConfiguration } from '@/modules/sessions/domain/value-objects/session-configuration/index.js'
import type { SessionRow } from '@/modules/sessions/infrastructure/clients/sessions-prisma-client/index.js'

import { SessionAudioMapper } from '../session-audio-mapper/index.js'

export class SessionMapper {
  constructor(private readonly audioMapper = new SessionAudioMapper()) {}

  toDomain(row: SessionRow): Session {
    return Session.reconstitute({
      sessionId: row.id,
      accountId: row.accountId,
      themeId: row.themeId,
      configuration: SessionConfiguration.create({
        difficulty: row.difficulty,
        categorySlug: row.categorySlug,
        searchWindowMinutes: row.searchWindowMinutes,
      }),
      quotaReservationId: row.quotaReservationId,
      state: row.state,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
      expiredReason: row.expiredReason,
      expiredAt: row.expiredAt,
      audio: row.audio === null ? null : this.audioMapper.toDomain(row.audio),
    })
  }

  toPersistence(session: Session): SessionRow {
    const audio = session.audio

    return {
      id: session.id,
      accountId: session.accountId,
      themeId: session.themeId,
      difficulty: session.configuration.difficulty,
      categorySlug: session.configuration.categorySlug,
      searchWindowMinutes: session.configuration.searchWindowMinutes,
      quotaReservationId: session.quotaReservationId,
      state: session.state,
      expiredReason: session.expiredReason,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      expiredAt: session.expiredAt,
      audio:
        audio === null
          ? null
          : {
              ...this.audioMapper.toCreateData(session.id, audio, session.createdAt),
              sessionId: session.id,
            },
    }
  }
}

import type { SessionConfiguration } from '@/modules/sessions/domain/value-objects/session-configuration/index.js'
import type { SessionAudio } from '@/modules/sessions/domain/value-objects/session-audio/index.js'

export type SessionState =
  'in_progress' | 'expired' | 'processing' | 'completed' | 'failed' | 'deleted'

export interface StartSessionParams {
  readonly sessionId: string
  readonly accountId: string
  readonly themeId: string
  readonly configuration: SessionConfiguration
  readonly createdAt: Date
}

export type SessionExpiredReason = 'timeout' | 'abandoned' | 'microphone_permission_denied'
export type SessionFailureReason = 'analysis_failed' | 'analysis_timeout'

export interface ReconstituteSessionParams extends StartSessionParams {
  readonly state: SessionState
  readonly expiresAt: Date
  readonly expiredReason: SessionExpiredReason | null
  readonly expiredAt: Date | null
  readonly failureReason?: SessionFailureReason | null
  readonly recordedAt: Date | null
  readonly recordingStartedAt?: Date | null
  readonly totalScore?: number | null
  readonly completedAt?: Date | null
  readonly failedAt?: Date | null
  readonly deletedAt?: Date | null
  readonly audio?: SessionAudio | null
}

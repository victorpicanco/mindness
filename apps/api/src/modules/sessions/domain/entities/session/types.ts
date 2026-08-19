import type { SessionConfiguration } from '@/modules/sessions/domain/value-objects/session-configuration/index.js'

export type SessionState =
  'in_progress' | 'expired' | 'processing' | 'completed' | 'failed' | 'deleted'

export interface StartSessionParams {
  readonly sessionId: string
  readonly accountId: string
  readonly themeId: string
  readonly configuration: SessionConfiguration
  readonly quotaReservationId: string
  readonly createdAt: Date
}

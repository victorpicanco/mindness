import type { AbandonSessionController } from '@/modules/sessions/presentation/controllers/abandon-session-controller/index.js'
import type { ConfirmAudioUploadController } from '@/modules/sessions/presentation/controllers/confirm-audio-upload-controller/index.js'
import type { GetActiveSessionController } from '@/modules/sessions/presentation/controllers/get-active-session-controller/index.js'
import type { ReportMicrophonePermissionDeniedController } from '@/modules/sessions/presentation/controllers/report-microphone-permission-denied-controller/index.js'
import type { RequestAudioUploadUrlController } from '@/modules/sessions/presentation/controllers/request-audio-upload-url-controller/index.js'
import type { StartSessionController } from '@/modules/sessions/presentation/controllers/start-session-controller/index.js'

export interface SessionsControllers {
  readonly startSession: StartSessionController
  readonly getActiveSession: GetActiveSessionController
  readonly abandonSession: AbandonSessionController
  readonly reportMicrophonePermissionDenied: ReportMicrophonePermissionDeniedController
  readonly requestAudioUploadUrl: RequestAudioUploadUrlController
  readonly confirmAudioUpload: ConfirmAudioUploadController
}

export const SESSIONS_ROUTE_PATHS = {
  session: '/sessions',
  activeSession: '/sessions/active',
  abandon: '/sessions/:sessionId/abandon',
  microphonePermissionDenied: '/sessions/:sessionId/microphone-permission-denied',
  audioUploadUrl: '/sessions/:sessionId/audio/upload-url',
  audioConfirm: '/sessions/:sessionId/audio/confirm',
} as const

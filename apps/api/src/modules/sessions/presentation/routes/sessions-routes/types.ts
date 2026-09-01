import type { AbandonSessionController } from '@/modules/sessions/presentation/controllers/abandon-session-controller/index.js'
import type { ConfirmAudioUploadController } from '@/modules/sessions/presentation/controllers/confirm-audio-upload-controller/index.js'
import type { DeleteSessionController } from '@/modules/sessions/presentation/controllers/delete-session-controller/index.js'
import type { GetActiveSessionController } from '@/modules/sessions/presentation/controllers/get-active-session-controller/index.js'
import type { ListSessionHistoryController } from '@/modules/sessions/presentation/controllers/list-session-history-controller/index.js'
import type { ListThemeCategoriesController } from '@/modules/sessions/presentation/controllers/list-theme-categories-controller/index.js'
import type { ReportMicrophonePermissionDeniedController } from '@/modules/sessions/presentation/controllers/report-microphone-permission-denied-controller/index.js'
import type { RequestAudioPlaybackUrlController } from '@/modules/sessions/presentation/controllers/request-audio-playback-url-controller/index.js'
import type { RequestAudioUploadUrlController } from '@/modules/sessions/presentation/controllers/request-audio-upload-url-controller/index.js'
import type { StartRecordingController } from '@/modules/sessions/presentation/controllers/start-recording-controller/index.js'
import type { StartSessionController } from '@/modules/sessions/presentation/controllers/start-session-controller/index.js'

export interface SessionsControllers {
  readonly startSession: StartSessionController
  readonly getActiveSession: GetActiveSessionController
  readonly listThemeCategories: ListThemeCategoriesController
  readonly abandonSession: AbandonSessionController
  readonly reportMicrophonePermissionDenied: ReportMicrophonePermissionDeniedController
  readonly startRecording: StartRecordingController
  readonly requestAudioUploadUrl: RequestAudioUploadUrlController
  readonly confirmAudioUpload: ConfirmAudioUploadController
  readonly deleteSession: DeleteSessionController
  readonly listSessionHistory: ListSessionHistoryController
  readonly requestAudioPlaybackUrl: RequestAudioPlaybackUrlController
}

export const SESSIONS_ROUTE_PATHS = {
  session: '/sessions',
  sessionById: '/sessions/:sessionId',
  activeSession: '/sessions/active',
  themeCategories: '/sessions/theme-categories',
  abandon: '/sessions/:sessionId/abandon',
  microphonePermissionDenied: '/sessions/:sessionId/microphone-permission-denied',
  recording: '/sessions/:sessionId/recording',
  audioUploadUrl: '/sessions/:sessionId/audio/upload-url',
  audioConfirm: '/sessions/:sessionId/audio/confirm',
  audioPlaybackUrl: '/sessions/:sessionId/audio/playback-url',
} as const

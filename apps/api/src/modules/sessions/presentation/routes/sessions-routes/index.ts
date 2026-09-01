import { type TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import type { FastifyInstance } from 'fastify'

import type { ResolveAccountIdentityUseCase } from '@/modules/sessions/application/use-cases/resolve-account-identity/index.js'
import {
  AbandonSessionResponseSchema,
  SessionIdParamsSchema as AbandonSessionIdParamsSchema,
  type SessionIdParams as AbandonSessionIdParams,
} from '@/modules/sessions/presentation/controllers/abandon-session-controller/schemas.js'
import {
  ConfirmAudioUploadResponseSchema,
  SessionIdParamsSchema as ConfirmAudioUploadParamsSchema,
  type SessionIdParams as ConfirmAudioUploadParams,
} from '@/modules/sessions/presentation/controllers/confirm-audio-upload-controller/schemas.js'
import {
  DeleteSessionResponseSchema,
  SessionIdParamsSchema as DeleteSessionParamsSchema,
  type SessionIdParams as DeleteSessionParams,
} from '@/modules/sessions/presentation/controllers/delete-session-controller/schemas.js'
import { ActiveSessionResponseSchema } from '@/modules/sessions/presentation/controllers/get-active-session-controller/schemas.js'
import {
  SessionHistoryQuerySchema,
  SessionHistoryResponseSchema,
  type SessionHistoryQuery,
} from '@/modules/sessions/presentation/controllers/list-session-history-controller/schemas.js'
import { SessionThemeCategoriesResponseSchema } from '@/modules/sessions/presentation/controllers/list-theme-categories-controller/schemas.js'
import {
  ReportMicrophonePermissionDeniedResponseSchema,
  SessionIdParamsSchema as ReportMicrophonePermissionDeniedParamsSchema,
  type SessionIdParams as ReportMicrophonePermissionDeniedParams,
} from '@/modules/sessions/presentation/controllers/report-microphone-permission-denied-controller/schemas.js'
import {
  RequestAudioUploadUrlResponseSchema,
  SessionIdParamsSchema as RequestAudioUploadUrlParamsSchema,
  type SessionIdParams as RequestAudioUploadUrlParams,
} from '@/modules/sessions/presentation/controllers/request-audio-upload-url-controller/schemas.js'
import {
  RequestAudioPlaybackUrlResponseSchema,
  SessionIdParamsSchema as RequestAudioPlaybackUrlParamsSchema,
  type SessionIdParams as RequestAudioPlaybackUrlParams,
} from '@/modules/sessions/presentation/controllers/request-audio-playback-url-controller/schemas.js'
import {
  StartRecordingResponseSchema,
  SessionIdParamsSchema as StartRecordingParamsSchema,
  type SessionIdParams as StartRecordingParams,
} from '@/modules/sessions/presentation/controllers/start-recording-controller/schemas.js'
import {
  StartSessionBodySchema,
  StartSessionResponseSchema,
  type StartSessionBody,
} from '@/modules/sessions/presentation/controllers/start-session-controller/schemas.js'
import { registerAuthenticatedIdentityGuard } from '@/modules/sessions/presentation/middleware/authenticated-identity-guard/index.js'
import { ErrorResponseSchema } from '@/shared/http/envelope/index.js'

import { SESSIONS_ROUTE_PATHS, type SessionsControllers } from './types.js'

const ERROR_RESPONSES = {
  400: ErrorResponseSchema,
  401: ErrorResponseSchema,
  403: ErrorResponseSchema,
  404: ErrorResponseSchema,
  409: ErrorResponseSchema,
  422: ErrorResponseSchema,
  500: ErrorResponseSchema,
}

export interface SessionsRoutesDeps {
  readonly controllers: SessionsControllers
  readonly resolveAccountIdentity: ResolveAccountIdentityUseCase
}

export async function registerSessionsRoutes(
  app: FastifyInstance,
  deps: SessionsRoutesDeps,
): Promise<void> {
  const { controllers } = deps

  await app.register((scope, _options, done) => {
    registerAuthenticatedIdentityGuard(scope, deps.resolveAccountIdentity)
    const authenticated = scope.withTypeProvider<TypeBoxTypeProvider>()

    authenticated.post<{ Body: StartSessionBody }>(
      SESSIONS_ROUTE_PATHS.session,
      {
        schema: {
          body: StartSessionBodySchema,
          response: { 201: StartSessionResponseSchema, ...ERROR_RESPONSES },
        },
      },
      (request, reply) => controllers.startSession.handle(request, reply),
    )

    authenticated.get<{ Querystring: SessionHistoryQuery }>(
      SESSIONS_ROUTE_PATHS.session,
      {
        schema: {
          querystring: SessionHistoryQuerySchema,
          response: { 200: SessionHistoryResponseSchema, ...ERROR_RESPONSES },
        },
      },
      (request, reply) => controllers.listSessionHistory.handle(request, reply),
    )

    authenticated.get(
      SESSIONS_ROUTE_PATHS.activeSession,
      { schema: { response: { 200: ActiveSessionResponseSchema, ...ERROR_RESPONSES } } },
      (request, reply) => controllers.getActiveSession.handle(request, reply),
    )

    authenticated.get(
      SESSIONS_ROUTE_PATHS.themeCategories,
      { schema: { response: { 200: SessionThemeCategoriesResponseSchema, ...ERROR_RESPONSES } } },
      (request, reply) => controllers.listThemeCategories.handle(request, reply),
    )

    authenticated.post<{ Params: AbandonSessionIdParams }>(
      SESSIONS_ROUTE_PATHS.abandon,
      {
        schema: {
          params: AbandonSessionIdParamsSchema,
          response: { 200: AbandonSessionResponseSchema, ...ERROR_RESPONSES },
        },
      },
      (request, reply) => controllers.abandonSession.handle(request, reply),
    )

    authenticated.post<{ Params: ReportMicrophonePermissionDeniedParams }>(
      SESSIONS_ROUTE_PATHS.microphonePermissionDenied,
      {
        schema: {
          params: ReportMicrophonePermissionDeniedParamsSchema,
          response: { 200: ReportMicrophonePermissionDeniedResponseSchema, ...ERROR_RESPONSES },
        },
      },
      (request, reply) => controllers.reportMicrophonePermissionDenied.handle(request, reply),
    )

    authenticated.post<{ Params: StartRecordingParams }>(
      SESSIONS_ROUTE_PATHS.recording,
      {
        schema: {
          params: StartRecordingParamsSchema,
          response: { 200: StartRecordingResponseSchema, ...ERROR_RESPONSES },
        },
      },
      (request, reply) => controllers.startRecording.handle(request, reply),
    )

    authenticated.post<{ Params: RequestAudioUploadUrlParams }>(
      SESSIONS_ROUTE_PATHS.audioUploadUrl,
      {
        schema: {
          params: RequestAudioUploadUrlParamsSchema,
          response: { 200: RequestAudioUploadUrlResponseSchema, ...ERROR_RESPONSES },
        },
      },
      (request, reply) => controllers.requestAudioUploadUrl.handle(request, reply),
    )

    authenticated.post<{ Params: ConfirmAudioUploadParams }>(
      SESSIONS_ROUTE_PATHS.audioConfirm,
      {
        schema: {
          params: ConfirmAudioUploadParamsSchema,
          response: { 200: ConfirmAudioUploadResponseSchema, ...ERROR_RESPONSES },
        },
      },
      (request, reply) => controllers.confirmAudioUpload.handle(request, reply),
    )

    authenticated.delete<{ Params: DeleteSessionParams }>(
      SESSIONS_ROUTE_PATHS.sessionById,
      {
        schema: {
          params: DeleteSessionParamsSchema,
          response: { 200: DeleteSessionResponseSchema, ...ERROR_RESPONSES },
        },
      },
      (request, reply) => controllers.deleteSession.handle(request, reply),
    )

    authenticated.post<{ Params: RequestAudioPlaybackUrlParams }>(
      SESSIONS_ROUTE_PATHS.audioPlaybackUrl,
      {
        schema: {
          params: RequestAudioPlaybackUrlParamsSchema,
          response: { 200: RequestAudioPlaybackUrlResponseSchema, ...ERROR_RESPONSES },
        },
      },
      (request, reply) => controllers.requestAudioPlaybackUrl.handle(request, reply),
    )

    done()
  })
}

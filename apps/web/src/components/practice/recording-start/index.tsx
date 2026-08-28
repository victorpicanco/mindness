'use client'

import { useMutation } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { ShinyText } from '@/components/ui/shiny-text'
import { VisuallyHidden } from '@/components/ui/visually-hidden'
import { bffFetch } from '@/lib/api/bff-client'
import { apiErrorDetails } from '@/lib/api/api-error'
import {
  microphonePermissionDeniedSchema,
  recordingStartedSchema,
} from '@/lib/api/contracts/sessions'
import { abandonSessionOnPageHide as abandonSessionOnPageHideRequest } from '@/lib/api/abandon-session'
import { submitRecording as requestRecordingSubmission } from '@/lib/api/submit-recording'
import { MicrophoneUnavailableError } from '@/lib/media/microphone-unavailable-error'
import { usePracticeSessionStore } from '@/stores/practice-session/provider'

import { SessionRecorder } from '@/components/practice/session-recorder'
import type { AudioLevelSource } from '@/components/practice/use-audio-levels'
import { useSessionDeadline } from '@/components/practice/use-session-deadline'

export interface AudioRecordingSession {
  readonly stop: () => Promise<Blob>
}

export interface RecordingStarted {
  readonly expiresAt: string
  readonly recordingStartedAt: string
}

export type AudioRecordingSource = (
  stream: MediaStream | undefined,
) => Promise<AudioRecordingSession>

export type SubmitRecordingRequest = (input: {
  readonly audioBlob: Blob
  readonly sessionId: string
}) => Promise<void>

export interface RecordingStartProps {
  readonly audioLevelSource?: AudioLevelSource
  readonly abandonSessionOnPageHide?: (sessionId: string) => void
  readonly captureRecording?: AudioRecordingSource
  readonly reportMicrophonePermissionDenied?: (sessionId: string) => Promise<void>
  readonly requestMicrophone?: () => Promise<MediaStream | undefined>
  readonly startRecording?: (sessionId: string) => Promise<RecordingStarted>
  readonly submitRecording?: SubmitRecordingRequest
}

type StartFailure = 'microphone' | 'permission-denied' | 'request'

type UploadFailure = 'audio-size' | 'audio-validation' | 'audio-upload' | 'session-closed'

function uploadFailure(error: unknown): UploadFailure {
  const { code } = apiErrorDetails(error)

  if (code === 'sessions.AUDIO_SIZE_REJECTED') return 'audio-size'
  if (code === 'sessions.AUDIO_VALIDATION_REJECTED') return 'audio-validation'
  if (code === 'sessions.SESSION_NOT_IN_PROGRESS') return 'session-closed'

  return 'audio-upload'
}

async function requestBrowserMicrophone(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({ audio: true })
}

async function requestRecordingStart(sessionId: string): Promise<RecordingStarted> {
  return bffFetch(`/sessions/${sessionId}/recording`, {
    method: 'POST',
    schema: recordingStartedSchema,
  })
}

async function reportDeniedMicrophonePermission(sessionId: string): Promise<void> {
  await bffFetch(`/sessions/${sessionId}/microphone-permission-denied`, {
    method: 'POST',
    schema: microphonePermissionDeniedSchema,
  })
}

async function browserAudioRecordingSource(
  stream: MediaStream | undefined,
): Promise<AudioRecordingSession> {
  await Promise.resolve()

  if (stream === undefined) {
    throw new MicrophoneUnavailableError('The browser did not return a microphone stream')
  }
  const chunks: Blob[] = []
  const recorder = new MediaRecorder(stream)

  recorder.addEventListener('dataavailable', (event) => {
    if (event.data.size > 0) chunks.push(event.data)
  })
  recorder.start()

  return {
    stop: () =>
      new Promise((resolve) => {
        recorder.addEventListener(
          'stop',
          () => {
            for (const track of stream.getTracks()) track.stop()
            resolve(new Blob(chunks, { type: recorder.mimeType }))
          },
          { once: true },
        )
        recorder.stop()
      }),
  }
}

export function RecordingStart({
  audioLevelSource,
  abandonSessionOnPageHide = abandonSessionOnPageHideRequest,
  captureRecording = browserAudioRecordingSource,
  reportMicrophonePermissionDenied = reportDeniedMicrophonePermission,
  requestMicrophone = requestBrowserMicrophone,
  startRecording = requestRecordingStart,
  submitRecording = requestRecordingSubmission,
}: RecordingStartProps) {
  const t = useTranslations('home.research')
  const translate = useTranslations()
  const router = useRouter()
  const session = usePracticeSessionStore((state) => state.session)
  const status = usePracticeSessionStore((state) => state.status)
  const storedAudioBlob = usePracticeSessionStore((state) => state.audioBlob)
  const openRecording = usePracticeSessionStore((state) => state.openRecording)
  const expireSession = usePracticeSessionStore((state) => state.expireSession)
  const captureAudio = usePracticeSessionStore((state) => state.captureAudio)
  const discardAudio = usePracticeSessionStore((state) => state.discardAudio)
  const beginProcessing = usePracticeSessionStore((state) => state.beginProcessing)
  const serverTimeOffsetMs = usePracticeSessionStore((state) => state.serverTimeOffsetMs)
  const [failure, setFailure] = useState<StartFailure | null>(null)
  const [uploadFailureReason, setUploadFailureReason] = useState<UploadFailure | null>(null)
  const captureRef = useRef<AudioRecordingSession | null>(null)

  useSessionDeadline({ onExpired: () => router.refresh() })

  const mutation = useMutation({
    mutationFn: async (sessionId: string) => {
      try {
        const stream = await requestMicrophone()
        const recording = await startRecording(sessionId)

        return { recording, stream }
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === 'NotAllowedError') {
          await reportMicrophonePermissionDenied(sessionId)
        }

        throw new MicrophoneUnavailableError(cause)
      }
    },
    onError: (error) => {
      const permissionDenied =
        error instanceof MicrophoneUnavailableError &&
        error.cause instanceof DOMException &&
        error.cause.name === 'NotAllowedError'

      if (permissionDenied) {
        setFailure('permission-denied')
        expireSession()
        return
      }

      setFailure(error instanceof MicrophoneUnavailableError ? 'microphone' : 'request')
    },
    onSuccess: ({ recording, stream }) => {
      setFailure(null)
      openRecording(recording)

      captureRecording(stream)
        .then((recordingSession) => {
          captureRef.current = recordingSession
        })
        .catch(() => {
          if (stream === undefined) return
          for (const track of stream.getTracks()) track.stop()
        })
    },
  })

  const submitMutation = useMutation({
    meta: { errorPresentation: 'toast' },
    mutationFn: submitRecording,
    onError: (error) => {
      const failureReason = uploadFailure(error)
      setUploadFailureReason(failureReason)
      if (failureReason === 'session-closed') expireSession()
    },
    onSuccess: () => {
      setUploadFailureReason(null)
      beginProcessing()
    },
  })

  useEffect(() => {
    if (session === null || (status !== 'recording' && status !== 'uploading')) return
    const sessionId = session.sessionId

    function preventPageUnload(event: BeforeUnloadEvent) {
      event.preventDefault()
    }

    function abandonPageExit() {
      abandonSessionOnPageHide(sessionId)
    }

    window.addEventListener('beforeunload', preventPageUnload)
    window.addEventListener('pagehide', abandonPageExit)

    return () => {
      window.removeEventListener('beforeunload', preventPageUnload)
      window.removeEventListener('pagehide', abandonPageExit)
    }
  }, [abandonSessionOnPageHide, session, status])

  async function finishRecording() {
    const recordingSession = captureRef.current
    if (recordingSession === null || session === null) return

    captureRef.current = null
    const audioBlob = await recordingSession.stop()

    captureAudio(audioBlob)
    submitMutation.mutate({ audioBlob, sessionId: session.sessionId })
  }

  function retryUpload() {
    if (session === null || storedAudioBlob === null) return
    submitMutation.mutate({ audioBlob: storedAudioBlob, sessionId: session.sessionId })
  }

  function discardRecording() {
    discardAudio()
    submitMutation.reset()
  }

  function uploadFailureMessage(reason: UploadFailure): string {
    if (reason === 'audio-size') return t('audioSizeRejected')
    if (reason === 'audio-validation') return t('audioValidationRejected')
    if (reason === 'session-closed') return t('sessionNotInProgress')
    return t('audioUploadFailed')
  }

  if (session === null) return null

  if (status === 'expired') {
    return (
      <div>
        {failure === 'permission-denied' ? (
          <p className="mb-3 text-center text-sm text-error" role="alert">
            {t('microphonePermissionDenied')}
          </p>
        ) : null}
        <SessionRecorder
          isDisabled
          isRecording={false}
          onLimitReached={() => undefined}
          onToggleRecording={() => undefined}
        />
      </div>
    )
  }

  if (status === 'recording') {
    return (
      <div aria-label={t('recordingActiveLabel')}>
        <SessionRecorder
          isDisabled={false}
          isRecording
          onLimitReached={() => {
            void finishRecording()
          }}
          onToggleRecording={() => {
            void finishRecording()
          }}
          serverTimeOffsetMs={serverTimeOffsetMs}
          {...(audioLevelSource === undefined ? {} : { source: audioLevelSource })}
          {...(session.recordingStartedAt === null
            ? {}
            : { startedAt: session.recordingStartedAt })}
        />
        <VisuallyHidden aria-live="polite">{t('recordingInProgress')}</VisuallyHidden>
      </div>
    )
  }

  if (status === 'uploading') {
    return (
      <section aria-label={t('uploadingLabel')} className="text-center">
        {submitMutation.isError && uploadFailureReason !== null ? (
          <div className="mb-3 flex flex-col items-center gap-3">
            <p className="text-sm text-error" role="alert">
              {uploadFailureMessage(uploadFailureReason)}
            </p>
            <div className="flex gap-3">
              {uploadFailureReason === 'audio-upload' ? (
                <Button onClick={retryUpload} type="button">
                  {t('retryUpload')}
                </Button>
              ) : null}
              <Button onClick={discardRecording} type="button" variant="secondary">
                {t('discardRecording')}
              </Button>
            </div>
          </div>
        ) : null}
        <SessionRecorder
          isDisabled
          isRecording={false}
          onLimitReached={() => undefined}
          onToggleRecording={() => undefined}
        />
      </section>
    )
  }

  if (status === 'processing' || status === 'done') {
    return (
      <SessionRecorder
        isDisabled
        isRecording={false}
        onLimitReached={() => undefined}
        onToggleRecording={() => undefined}
      />
    )
  }

  if (status === 'researching' || status === 'countdown-warning') {
    return (
      <SessionRecorder
        isDisabled
        isRecording={false}
        onLimitReached={() => undefined}
        onToggleRecording={() => undefined}
      />
    )
  }

  if (status !== 'awaiting-recording') return null

  function failureMessage(reason: StartFailure): string {
    if (reason === 'permission-denied') return t('microphonePermissionDenied')
    return reason === 'microphone' ? t('microphoneError') : translate('common.errors.unknown')
  }

  return (
    <section>
      {failure === null ? null : (
        <p className="mb-3 text-center text-sm text-error" role="alert">
          {failureMessage(failure)}
        </p>
      )}
      {mutation.isPending ? (
        <p className="mb-1.5 text-xs" role="status">
          <ShinyText text={t('preparingMicrophone')} />
        </p>
      ) : null}
      <SessionRecorder
        isDisabled={mutation.isPending}
        isRecording={false}
        onLimitReached={() => undefined}
        onToggleRecording={() => {
          setFailure(null)
          mutation.mutate(session.sessionId)
        }}
      />
    </section>
  )
}

'use client'

import { useMutation } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import posthog from 'posthog-js'
import { useEffect, useRef, useState } from 'react'

import { apiErrorDetails } from '@/lib/api/api-error'
import { bffFetch } from '@/lib/api/bff-client'
import {
  microphonePermissionDeniedSchema,
  recordingStartedSchema,
} from '@/lib/api/contracts/sessions'
import { abandonSessionOnPageHide as abandonSessionOnPageHideRequest } from '@/lib/api/abandon-session'
import { submitRecording as requestRecordingSubmission } from '@/lib/api/submit-recording'
import { MicrophoneUnavailableError } from '@/lib/media/microphone-unavailable-error'
import { usePracticeSessionStore } from '@/stores/practice-session/provider'

import { useSessionDeadline } from '@/components/practice/use-session-deadline'

export interface AudioRecordingSession {
  readonly stop: () => Promise<Blob>
}

export interface RecordingStarted {
  readonly expiresAt: string
  readonly recordingStartedAt: string
}

type AudioRecordingSource = (stream: MediaStream | undefined) => Promise<AudioRecordingSession>

export type SubmitRecordingRequest = (input: {
  readonly audioBlob: Blob
  readonly sessionId: string
}) => Promise<void>

export type StartFailure = 'microphone' | 'permission-denied'

export type UploadFailure = 'audio-size' | 'audio-validation' | 'audio-upload' | 'session-closed'

export interface RecordingCaptureDependencies {
  readonly abandonSessionOnPageHide?: (sessionId: string) => void
  readonly captureRecording?: AudioRecordingSource
  readonly reportMicrophonePermissionDenied?: (sessionId: string) => Promise<void>
  readonly requestMicrophone?: () => Promise<MediaStream | undefined>
  readonly startRecording?: (sessionId: string) => Promise<RecordingStarted>
  readonly submitRecording?: SubmitRecordingRequest
}

function uploadFailureOf(error: unknown): UploadFailure {
  const { code } = apiErrorDetails(error)

  if (code === 'sessions.AUDIO_SIZE_REJECTED') return 'audio-size'
  if (code === 'sessions.AUDIO_VALIDATION_REJECTED') return 'audio-validation'
  if (code === 'sessions.SESSION_NOT_IN_PROGRESS') return 'session-closed'

  return 'audio-upload'
}

async function requestBrowserMicrophone(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({ audio: true })
}

function releaseMicrophone(stream: MediaStream | undefined): void {
  if (stream === undefined) return

  for (const track of stream.getTracks()) track.stop()
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

function browserAudioRecordingSource(
  stream: MediaStream | undefined,
): Promise<AudioRecordingSession> {
  if (stream === undefined) {
    return Promise.reject(
      new MicrophoneUnavailableError('The browser did not return a microphone stream'),
    )
  }
  const chunks: Blob[] = []
  const recorder = new MediaRecorder(stream)

  recorder.addEventListener('dataavailable', (event) => {
    if (event.data.size > 0) chunks.push(event.data)
  })
  recorder.start()

  return Promise.resolve({
    stop: () =>
      new Promise((resolve) => {
        recorder.addEventListener(
          'stop',
          () => {
            releaseMicrophone(stream)
            resolve(new Blob(chunks, { type: recorder.mimeType }))
          },
          { once: true },
        )
        recorder.stop()
      }),
  })
}

export function useRecordingCapture({
  abandonSessionOnPageHide = abandonSessionOnPageHideRequest,
  captureRecording = browserAudioRecordingSource,
  reportMicrophonePermissionDenied = reportDeniedMicrophonePermission,
  requestMicrophone = requestBrowserMicrophone,
  startRecording = requestRecordingStart,
  submitRecording = requestRecordingSubmission,
}: RecordingCaptureDependencies) {
  const router = useRouter()
  const session = usePracticeSessionStore((state) => state.session)
  const status = usePracticeSessionStore((state) => state.status)
  const storedAudioBlob = usePracticeSessionStore((state) => state.audioBlob)
  const openRecording = usePracticeSessionStore((state) => state.openRecording)
  const expireSession = usePracticeSessionStore((state) => state.expireSession)
  const captureAudio = usePracticeSessionStore((state) => state.captureAudio)
  const discardAudio = usePracticeSessionStore((state) => state.discardAudio)
  const beginProcessing = usePracticeSessionStore((state) => state.beginProcessing)
  const [startFailure, setStartFailure] = useState<StartFailure | null>(null)
  const [uploadFailure, setUploadFailure] = useState<UploadFailure | null>(null)
  const captureRef = useRef<Promise<AudioRecordingSession | null> | null>(null)

  useSessionDeadline({ onExpired: () => router.refresh() })

  const startMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      let stream: MediaStream | undefined

      try {
        stream = await requestMicrophone()
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === 'NotAllowedError') {
          await reportMicrophonePermissionDenied(sessionId)
        }

        throw new MicrophoneUnavailableError(cause)
      }

      try {
        return { recording: await startRecording(sessionId), stream }
      } catch (cause) {
        releaseMicrophone(stream)

        throw cause
      }
    },
    onError: (error, sessionId) => {
      if (!(error instanceof MicrophoneUnavailableError)) return

      if (error.cause instanceof DOMException && error.cause.name === 'NotAllowedError') {
        posthog.capture('microphone_permission_denied', { session_id: sessionId })
        setStartFailure('permission-denied')
        expireSession()

        return
      }

      posthog.capture('session_expired', { session_id: sessionId, reason: 'microphone_error' })
      setStartFailure('microphone')
    },
    onSuccess: ({ recording, stream }, sessionId) => {
      setStartFailure(null)
      posthog.capture('recording_started', { session_id: sessionId })
      openRecording(recording)

      captureRef.current = captureRecording(stream).catch((): null => {
        releaseMicrophone(stream)
        setStartFailure('microphone')
        expireSession()

        return null
      })
    },
  })

  const submitMutation = useMutation({
    meta: { errorPresentation: 'inline' },
    mutationFn: submitRecording,
    onError: (error, { sessionId }) => {
      const reason = uploadFailureOf(error)

      posthog.capture('recording_upload_failed', { session_id: sessionId, reason })
      setUploadFailure(reason)
      if (reason === 'session-closed') expireSession()
    },
    onSuccess: (_, { sessionId }) => {
      setUploadFailure(null)
      beginProcessing()
      posthog.capture('recording_stopped', { session_id: sessionId })
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

  async function finish(): Promise<void> {
    const pendingCapture = captureRef.current
    if (pendingCapture === null || session === null) return

    captureRef.current = null
    const recordingSession = await pendingCapture
    if (recordingSession === null) return

    const audioBlob = await recordingSession.stop()

    captureAudio(audioBlob)
    submitMutation.mutate({ audioBlob, sessionId: session.sessionId })
  }

  return {
    discard: () => {
      if (session !== null) {
        posthog.capture('recording_discarded', { session_id: session.sessionId })
      }
      discardAudio()
      submitMutation.reset()
    },
    finish: () => {
      void finish()
    },
    hasUploadFailed: submitMutation.isError,
    isStarting: startMutation.isPending,
    retry: () => {
      if (session === null || storedAudioBlob === null) return

      submitMutation.mutate({ audioBlob: storedAudioBlob, sessionId: session.sessionId })
    },
    start: () => {
      if (session === null) return

      setStartFailure(null)
      startMutation.mutate(session.sessionId)
    },
    startFailure,
    uploadFailure,
  }
}

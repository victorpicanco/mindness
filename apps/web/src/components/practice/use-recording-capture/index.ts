'use client'

import { useMutation } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
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

export type StartFailure = 'microphone' | 'permission-denied' | 'request'

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

// eslint-disable-next-line @typescript-eslint/require-await -- The source is an async contract so a test double can defer the recorder.
async function browserAudioRecordingSource(
  stream: MediaStream | undefined,
): Promise<AudioRecordingSession> {
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
            releaseMicrophone(stream)
            resolve(new Blob(chunks, { type: recorder.mimeType }))
          },
          { once: true },
        )
        recorder.stop()
      }),
  }
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
    // The microphone and the server call fail for unrelated reasons, so an open stream is released
    // before the server failure surfaces and each one keeps its own message.
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
    onError: (error) => {
      const permissionDenied =
        error instanceof MicrophoneUnavailableError &&
        error.cause instanceof DOMException &&
        error.cause.name === 'NotAllowedError'

      if (permissionDenied) {
        setStartFailure('permission-denied')
        expireSession()

        return
      }

      setStartFailure(error instanceof MicrophoneUnavailableError ? 'microphone' : 'request')
    },
    // The pending capture is stored, not its result: stopping before the recorder is ready has to
    // wait for it instead of silently dropping the recording.
    onSuccess: ({ recording, stream }) => {
      setStartFailure(null)
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
    meta: { errorPresentation: 'toast' },
    mutationFn: submitRecording,
    onError: (error) => {
      const reason = uploadFailureOf(error)

      setUploadFailure(reason)
      if (reason === 'session-closed') expireSession()
    },
    onSuccess: () => {
      setUploadFailure(null)
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

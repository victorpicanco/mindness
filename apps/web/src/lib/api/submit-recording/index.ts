import { AudioUploadFailedError } from '@/lib/api/audio-upload-failed-error'
import { bffFetch } from '@/lib/api/bff-client'
import { audioUploadCredentialSchema, confirmAudioUploadSchema } from '@/lib/api/contracts/sessions'

export interface SubmitRecordingInput {
  readonly audioBlob: Blob
  readonly fetcher?: typeof fetch
  readonly sessionId: string
}

export async function submitRecording({
  audioBlob,
  fetcher = fetch,
  sessionId,
}: SubmitRecordingInput): Promise<void> {
  const credential = await bffFetch(`/sessions/${sessionId}/audio/upload-url`, {
    fetcher,
    method: 'POST',
    schema: audioUploadCredentialSchema,
  })

  const upload = await fetcher(credential.uploadUrl, { body: audioBlob, method: 'PUT' })

  if (!upload.ok) throw new AudioUploadFailedError()

  await bffFetch(`/sessions/${sessionId}/audio/confirm`, {
    fetcher,
    method: 'POST',
    schema: confirmAudioUploadSchema,
  })
}

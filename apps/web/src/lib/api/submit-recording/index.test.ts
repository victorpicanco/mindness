import { describe, expect, it } from 'vitest'

import { AudioUploadFailedError } from '@/lib/api/audio-upload-failed-error'
import { submitRecording } from '@/lib/api/submit-recording'

const SESSION_ID = '7d5f46c9-3cbd-4c6d-84aa-66b8148a91aa'
const UPLOAD_URL = 'https://storage.test/object/upload/sign/audio/path?token=upload-token'

interface RecordedCall {
  readonly body: unknown
  readonly method: string
  readonly url: string
}

function credentialResponse(): Response {
  return Response.json({
    data: { path: 'account/session/audio', token: 'upload-token', uploadUrl: UPLOAD_URL },
  })
}

function fakeFetch(storageResponse: Response): {
  calls: RecordedCall[]
  fetcher: typeof fetch
} {
  const calls: RecordedCall[] = []

  const fetcher: typeof fetch = (input, init) => {
    const { method, url } = new Request(input, init)

    calls.push({ body: init?.body ?? null, method, url })

    if (url === UPLOAD_URL) return Promise.resolve(storageResponse)
    if (url.endsWith('/audio/upload-url')) return Promise.resolve(credentialResponse())

    return Promise.resolve(Response.json({ data: null }))
  }

  return { calls, fetcher }
}

describe('submitRecording', () => {
  it('asks for a credential, uploads to the signed url and confirms the audio', async () => {
    const audioBlob = new Blob(['audio'], { type: 'audio/webm' })
    const { calls, fetcher } = fakeFetch(new Response(null, { status: 200 }))

    await submitRecording({ audioBlob, fetcher, sessionId: SESSION_ID })

    expect(calls).toEqual([
      {
        body: null,
        method: 'POST',
        url: `http://localhost:3000/api/bff/sessions/${SESSION_ID}/audio/upload-url`,
      },
      { body: audioBlob, method: 'PUT', url: UPLOAD_URL },
      {
        body: null,
        method: 'POST',
        url: `http://localhost:3000/api/bff/sessions/${SESSION_ID}/audio/confirm`,
      },
    ])
  })

  it('fails without confirming when the storage rejects the upload', async () => {
    const audioBlob = new Blob(['audio'], { type: 'audio/webm' })
    const { calls, fetcher } = fakeFetch(new Response(null, { status: 500 }))

    await expect(submitRecording({ audioBlob, fetcher, sessionId: SESSION_ID })).rejects.toThrow(
      AudioUploadFailedError,
    )
    expect(calls.map((call) => call.method)).toEqual(['POST', 'PUT'])
  })
})

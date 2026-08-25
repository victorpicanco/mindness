import { describe, expect, it } from 'vitest'

import { AudioUploadFailedError } from '@/lib/api/audio-upload-failed-error'

describe('AudioUploadFailedError', () => {
  it('provides one stable error identity for a rejected storage upload', () => {
    const error = new AudioUploadFailedError()

    expect(error).toBeInstanceOf(AudioUploadFailedError)
    expect(error).toMatchObject({ code: 'web.AUDIO_UPLOAD_FAILED' })
  })
})

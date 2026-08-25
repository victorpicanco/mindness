export class AudioUploadFailedError extends Error {
  readonly code = 'web.AUDIO_UPLOAD_FAILED'

  constructor(cause?: unknown) {
    super('The audio upload request failed', cause === undefined ? undefined : { cause })
    this.name = 'AudioUploadFailedError'
  }
}

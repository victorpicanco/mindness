export class MicrophoneUnavailableError extends Error {
  readonly code = 'web.MICROPHONE_UNAVAILABLE'

  constructor(cause: unknown) {
    super('The microphone is not available', { cause })
    this.name = 'MicrophoneUnavailableError'
  }
}

export interface AudioObjectPathParams {
  readonly accountId: string
  readonly sessionId: string
}

export class AudioObjectPath {
  private constructor(readonly value: string) {}

  static forSession(params: AudioObjectPathParams): AudioObjectPath {
    return new AudioObjectPath(`${params.accountId}/${params.sessionId}/audio`)
  }
}

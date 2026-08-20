export interface AudioObjectPathParams {
  readonly accountId: string
  readonly sessionId: string
}

export class AudioObjectPath {
  private constructor(readonly value: string) {}

  // D-06: fixed `<accountId>/<sessionId>/audio`, without extension — the real content type is
  // only known after validation.
  static forSession(params: AudioObjectPathParams): AudioObjectPath {
    return new AudioObjectPath(`${params.accountId}/${params.sessionId}/audio`)
  }
}

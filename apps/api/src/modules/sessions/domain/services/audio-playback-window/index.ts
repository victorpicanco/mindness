export const AUDIO_PLAYBACK_URL_TTL_SECONDS = 120

export class AudioPlaybackWindow {
  static from(now: Date): { readonly expiresInSeconds: number; readonly expiresAt: Date } {
    return {
      expiresInSeconds: AUDIO_PLAYBACK_URL_TTL_SECONDS,
      expiresAt: new Date(now.getTime() + AUDIO_PLAYBACK_URL_TTL_SECONDS * 1000),
    }
  }
}

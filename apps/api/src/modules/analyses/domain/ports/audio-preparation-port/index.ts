import type { AudioContent } from '@/modules/analyses/domain/ports/audio-reader-port/index.js'

export const CANONICAL_AUDIO_CONTENT_TYPE = 'audio/flac'

export interface PreparedAudio {
  readonly bytes: Buffer
  readonly contentType: typeof CANONICAL_AUDIO_CONTENT_TYPE
  readonly durationSeconds: number
}

export interface PrepareAudioInput {
  readonly source: AudioContent
  readonly signal: AbortSignal
}

export interface AudioPreparationPort {
  prepare(input: PrepareAudioInput): Promise<PreparedAudio>
}

import type { TranscriptionResult } from './types.js'

export interface TranscriptionPort {
  transcribe(input: {
    readonly audio: Buffer
    readonly deadlineMs: number
    readonly signal: AbortSignal
  }): Promise<TranscriptionResult>
}

export type { TranscriptionResult } from './types.js'

export interface TranscriptionWord {
  readonly word: string
  readonly start: number
  readonly end: number
  readonly confidence: number
}

export interface CreateTranscriptionParams {
  readonly transcriptionId: string
  readonly sessionId: string
  readonly text: string
  readonly words: readonly TranscriptionWord[]
  readonly durationSeconds: number
  readonly createdAt: Date
}

export interface ReconstituteTranscriptionParams extends CreateTranscriptionParams {
  readonly averageConfidence: number
}

import type {
  CreateTranscriptionParams,
  ReconstituteTranscriptionParams,
  TranscriptionWord,
} from './types.js'

export class Transcription {
  private constructor(
    readonly id: string,
    readonly sessionId: string,
    readonly text: string,
    readonly words: readonly TranscriptionWord[],
    readonly averageConfidence: number,
    readonly durationSeconds: number,
    private readonly createdAtEpoch: number,
  ) {}

  get createdAt(): Date {
    return new Date(this.createdAtEpoch)
  }

  static create(params: CreateTranscriptionParams): Transcription {
    return new Transcription(
      params.transcriptionId,
      params.sessionId,
      params.text,
      params.words,
      calculateAverageConfidence(params.words),
      params.durationSeconds,
      params.createdAt.getTime(),
    )
  }

  static reconstitute(params: ReconstituteTranscriptionParams): Transcription {
    return new Transcription(
      params.transcriptionId,
      params.sessionId,
      params.text,
      params.words,
      params.averageConfidence,
      params.durationSeconds,
      params.createdAt.getTime(),
    )
  }
}

function calculateAverageConfidence(words: readonly TranscriptionWord[]): number {
  if (words.length === 0) return 0

  const confidenceSum = words.reduce((sum, word) => sum + word.confidence, 0)

  return confidenceSum / words.length
}

export type {
  CreateTranscriptionParams,
  ReconstituteTranscriptionParams,
  TranscriptionWord,
} from './types.js'

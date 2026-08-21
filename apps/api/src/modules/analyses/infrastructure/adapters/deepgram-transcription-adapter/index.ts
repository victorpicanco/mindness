import { TranscriptionFailedError } from '@/modules/analyses/domain/errors/transcription-failed-error/index.js'
import type {
  TranscriptionPort,
  TranscriptionResult,
} from '@/modules/analyses/domain/ports/transcription-port/index.js'

import { parseTranscriptionResult } from './schemas.js'

interface DeepgramTranscriptionRequest {
  readonly model: 'nova-3'
  readonly language: 'pt-BR'
  readonly punctuate: true
  readonly smart_format: true
}

interface DeepgramRequestOptions {
  readonly timeoutInSeconds: number
  readonly maxRetries: 0
  readonly abortSignal: AbortSignal
}

interface DeepgramTranscriptionClient {
  readonly listen: {
    readonly v1: {
      readonly media: {
        transcribeFile(
          audio: Buffer,
          request: DeepgramTranscriptionRequest,
          requestOptions: DeepgramRequestOptions,
        ): Promise<unknown>
      }
    }
  }
}

export class DeepgramTranscriptionAdapter implements TranscriptionPort {
  constructor(private readonly client: DeepgramTranscriptionClient) {}

  async transcribe(input: {
    readonly audio: Buffer
    readonly deadlineMs: number
    readonly signal: AbortSignal
  }): Promise<TranscriptionResult> {
    if (input.signal.aborted) {
      throw new TranscriptionFailedError('request aborted')
    }

    try {
      const response = await this.client.listen.v1.media.transcribeFile(
        input.audio,
        {
          model: 'nova-3',
          language: 'pt-BR',
          punctuate: true,
          smart_format: true,
        },
        {
          timeoutInSeconds: Math.floor(input.deadlineMs / 1_000),
          maxRetries: 0,
          abortSignal: input.signal,
        },
      )

      return parseTranscriptionResult(response)
    } catch (error: unknown) {
      if (error instanceof TranscriptionFailedError) throw error
      throw new TranscriptionFailedError('Deepgram request failed', { cause: error })
    }
  }
}

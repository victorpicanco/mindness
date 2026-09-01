import ffmpegInstaller from '@ffmpeg-installer/ffmpeg'
import ffprobeInstaller from '@ffprobe-installer/ffprobe'
import ffmpeg from 'fluent-ffmpeg'
import { randomUUID } from 'node:crypto'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { AudioPreparationFailedError } from '@/modules/analyses/domain/errors/audio-preparation-failed-error/index.js'
import type {
  AudioPreparationPort,
  PrepareAudioInput,
  PreparedAudio,
} from '@/modules/analyses/domain/ports/audio-preparation-port/index.js'
import { CANONICAL_AUDIO_CONTENT_TYPE } from '@/modules/analyses/domain/ports/audio-preparation-port/index.js'

export const WORKSPACE_PREFIX = 'analysis-audio-'

const PREPARATION_TIMEOUT_SECONDS = 30
const CANONICAL_SAMPLE_RATE_HZ = 16_000
const CANONICAL_CHANNELS = 1
const MAX_PREPARED_SIZE_BYTES = 25 * 1024 * 1024
const MAX_PREPARED_DURATION_SECONDS = 60

export class FfmpegAudioPreparationAdapter implements AudioPreparationPort {
  constructor(private readonly timeoutSeconds: number = PREPARATION_TIMEOUT_SECONDS) {
    ffmpeg.setFfmpegPath(ffmpegInstaller.path)
    ffmpeg.setFfprobePath(ffprobeInstaller.path)
  }

  async prepare(input: PrepareAudioInput): Promise<PreparedAudio> {
    if (input.signal.aborted) throw new AudioPreparationFailedError('preparation aborted')

    const directory = await this.createWorkspace()
    const source = join(directory, randomUUID())
    const target = join(directory, `${randomUUID()}.flac`)

    try {
      await writeFile(source, input.source.bytes)
      await this.transcode(source, target, input.signal)

      const bytes = await readFile(target)
      const durationSeconds = await this.probeDuration(target)

      if (bytes.byteLength > MAX_PREPARED_SIZE_BYTES) {
        throw new AudioPreparationFailedError('prepared audio is too large')
      }
      if (durationSeconds > MAX_PREPARED_DURATION_SECONDS) {
        throw new AudioPreparationFailedError('prepared audio is too long')
      }

      return { bytes, contentType: CANONICAL_AUDIO_CONTENT_TYPE, durationSeconds }
    } catch (cause) {
      throw cause instanceof AudioPreparationFailedError
        ? cause
        : new AudioPreparationFailedError('transcoding failed', { cause })
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  }

  private async createWorkspace(): Promise<string> {
    try {
      return await mkdtemp(join(tmpdir(), WORKSPACE_PREFIX))
    } catch (cause) {
      throw new AudioPreparationFailedError('workspace unavailable', { cause })
    }
  }

  private transcode(source: string, target: string, signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      if (signal.aborted) {
        reject(new AudioPreparationFailedError('preparation aborted'))
        return
      }

      const command = ffmpeg(source, { timeout: this.timeoutSeconds })
        .noVideo()
        .audioCodec('flac')
        .audioChannels(CANONICAL_CHANNELS)
        .audioFrequency(CANONICAL_SAMPLE_RATE_HZ)
        .format('flac')
        .outputOptions('-v error')

      let running = false
      const abort = (): void => {
        if (running && signal.aborted) command.kill('SIGKILL')
      }
      signal.addEventListener('abort', abort, { once: true })

      const settle = (failure: AudioPreparationFailedError | null): void => {
        signal.removeEventListener('abort', abort)
        if (failure === null) resolve()
        else reject(failure)
      }

      command
        .on('start', () => {
          running = true
          abort()
        })
        .on('error', (error: Error) => {
          if (signal.aborted) {
            settle(new AudioPreparationFailedError('preparation aborted', { cause: error }))
            return
          }

          settle(
            isTimeout(error)
              ? new AudioPreparationFailedError('preparation timed out', { cause: error })
              : new AudioPreparationFailedError('transcoding failed', { cause: error }),
          )
        })
        .on('end', () =>
          settle(signal.aborted ? new AudioPreparationFailedError('preparation aborted') : null),
        )
        .save(target)
    })
  }

  private probeDuration(file: string): Promise<number> {
    return new Promise((resolve, reject) => {
      ffmpeg(file).ffprobe((error: Error | null, metadata: unknown) => {
        if (error !== null) {
          reject(
            new AudioPreparationFailedError('prepared audio is not readable', { cause: error }),
          )
          return
        }

        const durationSeconds = readDurationSeconds(metadata)
        if (durationSeconds === null) {
          reject(new AudioPreparationFailedError('prepared audio has no duration'))
          return
        }

        resolve(durationSeconds)
      })
    })
  }
}

function isTimeout(error: Error): boolean {
  return error.message.includes('timeout')
}

function readDurationSeconds(metadata: unknown): number | null {
  if (typeof metadata !== 'object' || metadata === null || !('format' in metadata)) return null

  const format: unknown = metadata.format
  if (typeof format !== 'object' || format === null || !('duration' in format)) return null

  const raw: unknown = format.duration
  const parsed = typeof raw === 'string' ? Number.parseFloat(raw) : raw

  if (typeof parsed !== 'number' || !Number.isFinite(parsed) || parsed <= 0) return null

  return parsed
}

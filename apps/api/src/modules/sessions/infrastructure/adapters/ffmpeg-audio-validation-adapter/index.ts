import ffmpegInstaller from '@ffmpeg-installer/ffmpeg'
import ffprobeInstaller from '@ffprobe-installer/ffprobe'
import ffmpeg from 'fluent-ffmpeg'
import { Readable } from 'node:stream'

import type {
  AudioValidationPort,
  InvalidAudio,
  ValidAudio,
} from '@/modules/sessions/domain/ports/audio-validation-port/index.js'

const FFMPEG_TIMEOUT_SECONDS = 5
const MAX_DURATION_SECONDS = 60

interface AudioStream {
  readonly codec_type?: string | undefined
}

interface ProbeData {
  readonly format: {
    readonly duration?: number | undefined
    readonly format_name?: string | undefined
  }
  readonly streams: readonly AudioStream[]
}

function getContentType(formatName: string | undefined): string | null {
  if (formatName === undefined) return null
  if (formatName.includes('webm')) return 'audio/webm'
  if (formatName.includes('ogg')) return 'audio/ogg'
  if (formatName.includes('wav')) return 'audio/wav'

  return null
}

function isValidDuration(duration: number | undefined): duration is number {
  return (
    duration !== undefined &&
    Number.isFinite(duration) &&
    duration > 0 &&
    duration <= MAX_DURATION_SECONDS
  )
}

function hasAudioStream(streams: readonly AudioStream[]): boolean {
  return streams.some((stream) => stream.codec_type === 'audio')
}

export class FfmpegAudioValidationAdapter implements AudioValidationPort {
  constructor() {
    ffmpeg.setFfmpegPath(ffmpegInstaller.path)
    ffmpeg.setFfprobePath(ffprobeInstaller.path)
  }

  async validate(input: { readonly buffer: Buffer }): Promise<ValidAudio | InvalidAudio> {
    try {
      const metadata = await this.probe(input.buffer)
      const contentType = getContentType(metadata.format.format_name)
      const durationSeconds = metadata.format.duration

      if (
        contentType === null ||
        !hasAudioStream(metadata.streams) ||
        !isValidDuration(durationSeconds)
      ) {
        return { ok: false }
      }

      if (!(await this.decodeFully(input.buffer))) return { ok: false }

      return { ok: true, durationSeconds, contentType }
    } catch {
      return { ok: false }
    }
  }

  private probe(buffer: Buffer): Promise<ProbeData> {
    return new Promise((resolve, reject) => {
      ffmpeg(Readable.from(buffer)).ffprobe((error: Error | null, metadata) => {
        if (error !== null) {
          reject(error)
          return
        }

        resolve(metadata)
      })
    })
  }

  private decodeFully(buffer: Buffer): Promise<boolean> {
    return new Promise((resolve) => {
      const errors: string[] = []
      const command = ffmpeg(Readable.from(buffer), { timeout: FFMPEG_TIMEOUT_SECONDS })
        .outputOptions('-v error')
        .format('null')
        .output('-')
        .on('stderr', (line: string) => errors.push(line))
        .on('error', () => resolve(false))
        .on('end', () => resolve(errors.length === 0))

      command.run()
    })
  }
}

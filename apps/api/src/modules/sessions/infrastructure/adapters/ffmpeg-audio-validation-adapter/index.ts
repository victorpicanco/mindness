import ffmpegInstaller from '@ffmpeg-installer/ffmpeg'
import ffprobeInstaller from '@ffprobe-installer/ffprobe'
import ffmpeg from 'fluent-ffmpeg'
import { randomUUID } from 'node:crypto'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type {
  AudioValidationPort,
  InvalidAudio,
  ValidAudio,
  ValidateAudioInput,
} from '@/modules/sessions/domain/ports/audio-validation-port/index.js'

import { AudioValidationProviderError } from './errors.js'

const DECODE_TIMEOUT_SECONDS = 30
const SPAWN_FAILURE_CODES = ['ENOENT', 'EACCES', 'EPERM', 'EMFILE', 'ENFILE', 'ENOMEM']

const CONTENT_TYPE_BY_FORMAT: ReadonlyArray<readonly [string, string]> = [
  ['webm', 'audio/webm'],
  ['matroska', 'audio/webm'],
  ['ogg', 'audio/ogg'],
  ['wav', 'audio/wav'],
  ['m4a', 'audio/mp4'],
  ['mp4', 'audio/mp4'],
  ['aac', 'audio/aac'],
  ['mp3', 'audio/mpeg'],
  ['flac', 'audio/flac'],
]

interface ProbedAudio {
  readonly durationSeconds: number
  readonly contentType: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readDurationSeconds(format: Record<string, unknown>): number | null {
  const raw = format.duration
  const parsed = typeof raw === 'string' ? Number.parseFloat(raw) : raw

  if (typeof parsed !== 'number' || !Number.isFinite(parsed) || parsed <= 0) return null

  return parsed
}

function readContentType(format: Record<string, unknown>): string | null {
  const formatName = format.format_name
  if (typeof formatName !== 'string') return null

  const names = formatName.split(',').map((name) => name.trim().toLowerCase())
  for (const [needle, contentType] of CONTENT_TYPE_BY_FORMAT) {
    if (names.includes(needle)) return contentType
  }

  return null
}

function hasAudioStream(streams: unknown): boolean {
  return (
    Array.isArray(streams) &&
    streams.some((stream) => isRecord(stream) && stream.codec_type === 'audio')
  )
}

function isSpawnFailure(error: unknown): boolean {
  if (!isRecord(error)) return false
  const code = error.code

  return typeof code === 'string' && SPAWN_FAILURE_CODES.includes(code)
}

export class FfmpegAudioValidationAdapter implements AudioValidationPort {
  constructor() {
    ffmpeg.setFfmpegPath(ffmpegInstaller.path)
    ffmpeg.setFfprobePath(ffprobeInstaller.path)
  }

  async validate(input: ValidateAudioInput): Promise<ValidAudio | InvalidAudio> {
    const directory = await this.createWorkspace()
    const file = join(directory, randomUUID())

    try {
      await writeFile(file, input.buffer)

      const probed = await this.probe(file)
      if (probed === null) return { ok: false }
      if (!(await this.decodesFully(file))) return { ok: false }

      return { ok: true, durationSeconds: probed.durationSeconds, contentType: probed.contentType }
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  }

  private async createWorkspace(): Promise<string> {
    try {
      return await mkdtemp(join(tmpdir(), 'session-audio-'))
    } catch (error) {
      throw new AudioValidationProviderError('create_workspace', error)
    }
  }

  private probe(file: string): Promise<ProbedAudio | null> {
    return new Promise((resolve, reject) => {
      ffmpeg(file).ffprobe((error: Error | null, metadata: unknown) => {
        if (error !== null) {
          if (isSpawnFailure(error)) {
            reject(new AudioValidationProviderError('ffprobe', error))
            return
          }

          resolve(null)
          return
        }

        if (
          !isRecord(metadata) ||
          !isRecord(metadata.format) ||
          !hasAudioStream(metadata.streams)
        ) {
          resolve(null)
          return
        }

        const durationSeconds = readDurationSeconds(metadata.format)
        const contentType = readContentType(metadata.format)
        resolve(
          durationSeconds === null || contentType === null
            ? null
            : { durationSeconds, contentType },
        )
      })
    })
  }

  private decodesFully(file: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const stderr: string[] = []

      ffmpeg(file, { timeout: DECODE_TIMEOUT_SECONDS })
        .inputOptions('-xerror')
        .outputOptions('-v error')
        .format('null')
        .output('-')
        .on('stderr', (line: string) => stderr.push(line))
        .on('error', (error: unknown) => {
          if (isSpawnFailure(error)) {
            reject(new AudioValidationProviderError('ffmpeg', error))
            return
          }

          resolve(false)
        })
        .on('end', () => resolve(stderr.length === 0))
        .run()
    })
  }
}

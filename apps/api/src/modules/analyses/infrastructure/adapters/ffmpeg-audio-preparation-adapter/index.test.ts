import ffmpegInstaller from '@ffmpeg-installer/ffmpeg'
import ffprobeInstaller from '@ffprobe-installer/ffprobe'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Type } from 'typebox'
import { Value } from 'typebox/value'
import { afterAll, describe, expect, it } from 'vitest'

import { FfmpegAudioPreparationAdapter, WORKSPACE_PREFIX } from './index.js'

const workspace = mkdtempSync(join(tmpdir(), 'audio-preparation-test-'))
const sourcePath = fileURLToPath(new URL('./fixtures/source.webm', import.meta.url))

const ProbeSchema = Type.Object({
  format: Type.Object({ duration: Type.String() }),
  streams: Type.Array(
    Type.Object({
      codec_name: Type.String(),
      channels: Type.Integer(),
      sample_rate: Type.String(),
    }),
  ),
})

interface ProbedStream {
  readonly codecName: string
  readonly channels: number
  readonly sampleRate: number
  readonly durationSeconds: number
}

function transcodeSource(extension: string, codecArgs: readonly string[]): Buffer {
  const output = join(workspace, `source.${extension}`)
  execFileSync(ffmpegInstaller.path, ['-y', '-v', 'error', '-i', sourcePath, ...codecArgs, output])

  return readFileSync(output)
}

function probe(bytes: Buffer): ProbedStream {
  const file = join(workspace, `probe-${Date.now()}-${Math.random()}`)
  writeFileSync(file, bytes)
  const raw = execFileSync(ffprobeInstaller.path, [
    '-v',
    'error',
    '-show_format',
    '-show_streams',
    '-print_format',
    'json',
    file,
  ]).toString()
  const parsed: unknown = JSON.parse(raw)

  if (!Value.Check(ProbeSchema, parsed)) {
    return { codecName: '', channels: 0, sampleRate: 0, durationSeconds: 0 }
  }

  const stream = parsed.streams[0]

  return {
    codecName: stream?.codec_name ?? '',
    channels: stream?.channels ?? 0,
    sampleRate: Number.parseInt(stream?.sample_rate ?? '0', 10),
    durationSeconds: Number.parseFloat(parsed.format.duration),
  }
}

function leakedWorkspaces(): readonly string[] {
  return readdirSync(tmpdir()).filter((entry) => entry.startsWith(WORKSPACE_PREFIX))
}

const sourceContent = {
  bytes: readFileSync(sourcePath),
  contentType: 'audio/webm',
  durationSeconds: 1.008,
}

afterAll(() => {
  rmSync(workspace, { recursive: true, force: true })
})

describe('FfmpegAudioPreparationAdapter', () => {
  const adapter = new FfmpegAudioPreparationAdapter()

  it.each([
    { container: 'WebM', bytes: () => sourceContent.bytes, contentType: 'audio/webm' },
    {
      container: 'M4A',
      bytes: () => transcodeSource('m4a', ['-c:a', 'aac']),
      contentType: 'audio/mp4',
    },
    {
      container: 'WAV',
      bytes: () => transcodeSource('wav', ['-c:a', 'pcm_s16le']),
      contentType: 'audio/wav',
    },
  ])(
    'converts a valid $container recording to canonical mono FLAC',
    async ({ bytes, contentType }) => {
      const prepared = await adapter.prepare({
        source: { bytes: bytes(), contentType, durationSeconds: 1.008 },
        signal: new AbortController().signal,
      })

      expect(prepared.contentType).toBe('audio/flac')
      expect(probe(prepared.bytes)).toMatchObject({
        codecName: 'flac',
        channels: 1,
        sampleRate: 16_000,
      })
      expect(prepared.durationSeconds).toBeCloseTo(1.008, 1)
    },
  )

  it('leaves no temporary workspace behind after a conversion', async () => {
    await adapter.prepare({ source: sourceContent, signal: new AbortController().signal })

    expect(leakedWorkspaces()).toEqual([])
  })

  it('rejects an input that is not decodable audio', async () => {
    const source = {
      bytes: Buffer.from('not audio at all'),
      contentType: 'audio/webm',
      durationSeconds: 1,
    }

    await expect(
      adapter.prepare({ source, signal: new AbortController().signal }),
    ).rejects.toMatchObject({ code: 'analyses.AUDIO_PREPARATION_FAILED' })
    expect(leakedWorkspaces()).toEqual([])
  })

  it('rejects a conversion that runs into its timeout', async () => {
    const impatient = new FfmpegAudioPreparationAdapter(0.001)

    await expect(
      impatient.prepare({ source: sourceContent, signal: new AbortController().signal }),
    ).rejects.toMatchObject({
      code: 'analyses.AUDIO_PREPARATION_FAILED',
      context: { reason: 'preparation timed out' },
    })
    expect(leakedWorkspaces()).toEqual([])
  })

  it('rejects a conversion aborted while it runs', async () => {
    const controller = new AbortController()
    const pending = adapter.prepare({ source: sourceContent, signal: controller.signal })
    controller.abort()

    await expect(pending).rejects.toMatchObject({
      code: 'analyses.AUDIO_PREPARATION_FAILED',
      context: { reason: 'preparation aborted' },
    })
    expect(leakedWorkspaces()).toEqual([])
  })

  it('rejects a conversion requested with an already aborted signal', async () => {
    const controller = new AbortController()
    controller.abort()

    await expect(
      adapter.prepare({ source: sourceContent, signal: controller.signal }),
    ).rejects.toMatchObject({
      code: 'analyses.AUDIO_PREPARATION_FAILED',
      context: { reason: 'preparation aborted' },
    })
  })
})

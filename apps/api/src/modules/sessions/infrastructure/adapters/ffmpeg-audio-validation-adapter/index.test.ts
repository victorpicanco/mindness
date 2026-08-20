import ffmpegInstaller from '@ffmpeg-installer/ffmpeg'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import ffmpeg from 'fluent-ffmpeg'
import { afterAll, describe, expect, it } from 'vitest'

import { InfrastructureError } from '@/shared/errors/infrastructure-error/index.js'

import { FfmpegAudioValidationAdapter } from './index.js'

const workspace = mkdtempSync(join(tmpdir(), 'audio-validation-test-'))

function readFixture(name: string): Buffer {
  return readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)))
}

// The fixtures committed to the repository are WebM; the other containers a browser can hand
// us are transcoded from the same source so the expectation is about the container, not the
// recording.
function transcodeValidFixture(extension: string, codecArgs: readonly string[]): Buffer {
  const output = join(workspace, `valid.${extension}`)
  execFileSync(ffmpegInstaller.path, [
    '-y',
    '-v',
    'error',
    '-i',
    fileURLToPath(new URL('./fixtures/valid.webm', import.meta.url)),
    ...codecArgs,
    output,
  ])

  return readFileSync(output)
}

afterAll(() => {
  rmSync(workspace, { recursive: true, force: true })
})

describe('FfmpegAudioValidationAdapter', () => {
  const adapter = new FfmpegAudioValidationAdapter()

  it('accepts a fully decodable WebM audio fixture', async () => {
    const result = await adapter.validate({ buffer: readFixture('valid.webm') })

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.contentType).toBe('audio/webm')
    expect(result.durationSeconds).toBeCloseTo(1, 0)
  })

  // Chrome and Firefox record WebM, Safari records audio/mp4. Rejecting either would lock a
  // whole browser out of RF-003.
  it.each([
    { container: 'audio/mp4 (Safari MediaRecorder)', extension: 'm4a', args: ['-c:a', 'aac'] },
    { container: 'audio/ogg', extension: 'ogg', args: ['-c:a', 'libvorbis'] },
    { container: 'audio/mpeg', extension: 'mp3', args: ['-c:a', 'libmp3lame'] },
    { container: 'audio/wav', extension: 'wav', args: ['-c:a', 'pcm_s16le'] },
  ])('accepts $container and reports its real duration', async ({ extension, args }) => {
    const result = await adapter.validate({ buffer: transcodeValidFixture(extension, args) })

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.contentType).toMatch(/^audio\//)
    expect(result.durationSeconds).toBeCloseTo(1, 0)
  })

  it('reports the duration of a container that keeps it outside the header', async () => {
    const result = await adapter.validate({
      buffer: transcodeValidFixture('ogg', ['-c:a', 'libvorbis']),
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return

    // Probing a pipe instead of a file makes ffprobe answer 'N/A' here.
    expect(Number.isFinite(result.durationSeconds)).toBe(true)
    expect(result.durationSeconds).toBeGreaterThan(0)
  })

  it('rejects arbitrary bytes renamed as audio', async () => {
    await expect(adapter.validate({ buffer: readFixture('random-bytes.ogg') })).resolves.toEqual({
      ok: false,
    })
  })

  it('rejects a truncated WAV whose header still passes probing', async () => {
    await expect(adapter.validate({ buffer: readFixture('truncated.wav') })).resolves.toEqual({
      ok: false,
    })
  })

  it('rejects an empty buffer', async () => {
    await expect(adapter.validate({ buffer: Buffer.alloc(0) })).resolves.toEqual({ ok: false })
  })

  // D-08: the port reports the observed duration; deciding that 60s is too long belongs to
  // the use case, not to infrastructure.
  it('reports the duration of a recording longer than the domain limit instead of judging it', async () => {
    const result = await adapter.validate({ buffer: readFixture('too-long.webm') })

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.durationSeconds).toBeGreaterThan(60)
  })

  // LAW-009.14: a decoder that cannot be launched is an outage. Reporting it as `{ ok: false }`
  // would tell the person their recording is invalid because the server is broken.
  it('raises an infrastructure error instead of rejecting the audio when ffprobe cannot start', async () => {
    ffmpeg.setFfprobePath(join(workspace, 'ffprobe-that-does-not-exist'))

    try {
      await expect(adapter.validate({ buffer: readFixture('valid.webm') })).rejects.toBeInstanceOf(
        InfrastructureError,
      )
    } finally {
      // The constructor is what installs the real binary paths.
      new FfmpegAudioValidationAdapter()
    }
  })
})

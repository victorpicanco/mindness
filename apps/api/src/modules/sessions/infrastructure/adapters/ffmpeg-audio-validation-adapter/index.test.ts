import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { FfmpegAudioValidationAdapter } from './index.js'

function readFixture(name: string): Buffer {
  return readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)))
}

describe('FfmpegAudioValidationAdapter', () => {
  const adapter = new FfmpegAudioValidationAdapter()

  it('accepts a fully decodable WebM audio fixture', async () => {
    const result = await adapter.validate({ buffer: readFixture('valid.webm') })

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.contentType).toBe('audio/webm')
    expect(result.durationSeconds).toBeCloseTo(1, 0)
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

  it('rejects audio longer than 60 seconds', async () => {
    await expect(adapter.validate({ buffer: readFixture('too-long.webm') })).resolves.toEqual({
      ok: false,
    })
  })
})

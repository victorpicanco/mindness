import { describe, expect, it } from 'vitest'

import { UuidGenerator } from './index.js'

const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

describe('UuidGenerator', () => {
  it('generates a string in UUID v4 format', () => {
    const generator = new UuidGenerator()

    expect(generator.generate()).toMatch(UUID_V4_PATTERN)
  })

  it('generates different values on consecutive calls', () => {
    const generator = new UuidGenerator()

    expect(generator.generate()).not.toBe(generator.generate())
  })
})

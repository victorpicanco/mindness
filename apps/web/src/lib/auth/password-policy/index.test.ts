import { describe, expect, it } from 'vitest'

import { passwordSchema } from './index'

describe('passwordSchema', () => {
  it('accepts an eight-character password with every required character set', () => {
    expect(passwordSchema.safeParse('Abcdef1!').success).toBe(true)
  })

  it.each([
    ['fewer than eight characters', 'Abcde1!'],
    ['no lowercase letter', 'ABCDEF1!'],
    ['no uppercase letter', 'abcdef1!'],
    ['no digit', 'Abcdefg!'],
    ['no symbol', 'Abcdefg1'],
  ])('rejects a password with %s', (_reason, password) => {
    expect(passwordSchema.safeParse(password).success).toBe(false)
  })
})

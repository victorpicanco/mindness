import { Type } from '@fastify/type-provider-typebox'
import { describe, expect, it } from 'vitest'
import { Check } from 'typebox/value'

import { successSchema } from '@/shared/http/envelope/index.js'

describe('successSchema', () => {
  it('requires only data and forbids additional properties when meta is omitted', () => {
    const schema = successSchema(Type.String())

    expect(Check(schema, { data: 'x' })).toBe(true)
    expect(Check(schema, {})).toBe(false)
    expect(Check(schema, { data: 'x', meta: {} })).toBe(false)
  })

  it('requires both data and meta when meta is given', () => {
    const schema = successSchema(Type.String(), Type.Object({ nextCursor: Type.String() }))

    expect(Check(schema, { data: 'x', meta: { nextCursor: 'c1' } })).toBe(true)
    expect(Check(schema, { data: 'x' })).toBe(false)
    expect(Check(schema, { meta: { nextCursor: 'c1' } })).toBe(false)
  })
})

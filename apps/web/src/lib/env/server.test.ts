import { describe, expect, it } from 'vitest'

import { EnvironmentError } from './errors'
import { readServerEnv } from './server'

describe('readServerEnv', () => {
  it('returns the validated server environment', () => {
    expect(readServerEnv({ API_BASE_URL: 'https://api.mindness.test' })).toEqual({
      API_BASE_URL: 'https://api.mindness.test',
    })
  })

  it('rejects an absent API base URL', () => {
    expect(() => readServerEnv({})).toThrow(EnvironmentError)
  })

  it('rejects an API base URL that is not a URL', () => {
    expect(() => readServerEnv({ API_BASE_URL: 'localhost:3333' })).toThrow(EnvironmentError)
  })

  it('names the offending variable so the failure is actionable', () => {
    try {
      readServerEnv({})
      expect.unreachable('readServerEnv should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(EnvironmentError)
      expect(error).toMatchObject({
        code: 'web.ENVIRONMENT_INVALID',
        variables: ['API_BASE_URL'],
      })
    }
  })
})

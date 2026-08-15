import { describe, expect, it } from 'vitest'

import { ValidationFailedError } from '@/shared/errors/validation-failed-error/index.js'

import { loadConfig } from './config.js'

const VALID_ENV: NodeJS.ProcessEnv = {
  NODE_ENV: 'test',
  PORT: '3333',
  WORKER_HEALTH_PORT: '3334',
  LOG_LEVEL: 'info',
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
}

describe('loadConfig', () => {
  it('returns a typed config object when every variable is present', () => {
    const config = loadConfig(VALID_ENV)

    expect(config).toEqual({
      nodeEnv: 'test',
      port: 3333,
      workerHealthPort: 3334,
      logLevel: 'info',
      databaseUrl: 'postgresql://user:pass@localhost:5432/db',
    })
  })

  it('lists the missing variable name and leaks no other value', () => {
    const envWithoutDatabaseUrl = { ...VALID_ENV }
    delete envWithoutDatabaseUrl.DATABASE_URL

    let caught: unknown
    try {
      loadConfig(envWithoutDatabaseUrl)
    } catch (error) {
      caught = error
    }

    expect(caught).toBeInstanceOf(ValidationFailedError)
    if (!(caught instanceof ValidationFailedError)) return

    expect(caught.context.issues).toEqual([
      { field: 'DATABASE_URL', message: 'Missing required environment variable: DATABASE_URL' },
    ])
  })

  it('rejects a non-numeric PORT', () => {
    expect(() => loadConfig({ ...VALID_ENV, PORT: 'not-a-number' })).toThrow(ValidationFailedError)
  })
})

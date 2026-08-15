import { describe, expect, it } from 'vitest'

import { ValidationFailedError } from '@/shared/errors/validation-failed-error/index.js'

import { loadConfig } from './config.js'

const VALID_ENV: NodeJS.ProcessEnv = {
  NODE_ENV: 'test',
  PORT: '3333',
  WORKER_HEALTH_PORT: '3334',
  LOG_LEVEL: 'info',
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  PUBLIC_API_URL: 'https://api.mindness.test',
  SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_SECRET_KEY: 'secret-key',
  EMAIL_CONFIRMATION_REDIRECT_URL: 'https://app.mindness.test/auth/confirmed',
  ACCOUNTS_CONSENT_VERSION: '2026-08-15',
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
      publicApiUrl: 'https://api.mindness.test',
      supabaseUrl: 'https://project.supabase.co',
      supabaseSecretKey: 'secret-key',
      emailConfirmationRedirectUrl: 'https://app.mindness.test/auth/confirmed',
      accountsConsentVersion: '2026-08-15',
    })
  })

  it('lists every missing account variable without leaking the secret', () => {
    const envWithoutSupabase = { ...VALID_ENV }
    delete envWithoutSupabase.SUPABASE_SECRET_KEY

    expect(() => loadConfig(envWithoutSupabase)).toThrow(ValidationFailedError)
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

import { describe, expect, it } from 'vitest'

import { ValidationFailedError } from '@/shared/errors/validation-failed-error/index.js'

import { loadConfig } from './config.js'

const VALID_ENV: NodeJS.ProcessEnv = {
  NODE_ENV: 'test',
  HOST: '127.0.0.1',
  PORT: '3333',
  WORKER_HEALTH_PORT: '3334',
  LOG_LEVEL: 'info',
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  PUBLIC_API_URL: 'https://api.mindness.test',
  PUBLIC_WEB_URL: 'https://app.mindness.test',
  SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'publishable-key',
  SUPABASE_SECRET_KEY: 'secret-key',
  EMAIL_CONFIRMATION_REDIRECT_URL: 'https://app.mindness.test/auth/confirmed',
  ACCOUNTS_CONSENT_VERSION: '2026-08-15',
  TRUST_PROXY: 'false',
  REDIS_URL: 'redis://localhost:6379',
  DEEPGRAM_API_KEY: 'deepgram-api-key',
  GOOGLE_CLOUD_PROJECT: 'mindness-test',
  GOOGLE_CLOUD_LOCATION: 'us-central1',
  GEMINI_MODEL: 'gemini-2.5-flash',
  DEEPGRAM_COST_PER_MINUTE_MICROS: '4800',
  GEMINI_INPUT_COST_PER_MTOK_MICROS: '300000',
  GEMINI_OUTPUT_COST_PER_MTOK_MICROS: '2500000',
  ANALYSIS_QUEUE_CONCURRENCY: '5',
  AUTH_RATE_LIMIT_MAX: '20',
  AUTH_RATE_LIMIT_WINDOW_MS: '60000',
}

describe('loadConfig', () => {
  it('returns a typed config object when every variable is present', () => {
    const config = loadConfig(VALID_ENV)

    expect(config).toEqual({
      nodeEnv: 'test',
      host: '127.0.0.1',
      port: 3333,
      workerHealthPort: 3334,
      logLevel: 'info',
      databaseUrl: 'postgresql://user:pass@localhost:5432/db',
      publicApiUrl: 'https://api.mindness.test',
      publicWebUrl: 'https://app.mindness.test',
      supabaseUrl: 'https://project.supabase.co',
      supabasePublishableKey: 'publishable-key',
      supabaseSecretKey: 'secret-key',
      emailConfirmationRedirectUrl: 'https://app.mindness.test/auth/confirmed',
      accountsConsentVersion: '2026-08-15',
      trustProxy: false,
      redisUrl: 'redis://localhost:6379',
      deepgramApiKey: 'deepgram-api-key',
      googleCloudProject: 'mindness-test',
      googleCloudLocation: 'us-central1',
      geminiModel: 'gemini-2.5-flash',
      deepgramCostPerMinuteMicros: 4800,
      geminiInputCostPerMtokMicros: 300000,
      geminiOutputCostPerMtokMicros: 2500000,
      analysisQueueConcurrency: 5,
      authRateLimitMax: 20,
      authRateLimitWindowMs: 60000,
    })
  })

  it('lists every missing account variable without leaking the secret', () => {
    const envWithoutSupabase = { ...VALID_ENV }
    delete envWithoutSupabase.SUPABASE_SECRET_KEY

    expect(() => loadConfig(envWithoutSupabase)).toThrow(ValidationFailedError)
  })

  it('rejects an environment without the supabase publishable key', () => {
    const envWithoutPublishableKey = { ...VALID_ENV }
    delete envWithoutPublishableKey.SUPABASE_PUBLISHABLE_KEY

    expect(() => loadConfig(envWithoutPublishableKey)).toThrow(ValidationFailedError)
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

  it('reads TRUST_PROXY as a boolean', () => {
    expect(loadConfig({ ...VALID_ENV, TRUST_PROXY: 'true' }).trustProxy).toBe(true)
  })

  it('rejects a TRUST_PROXY that is neither true nor false', () => {
    expect(() => loadConfig({ ...VALID_ENV, TRUST_PROXY: 'yes' })).toThrow(ValidationFailedError)
  })

  it('lists TRUST_PROXY when it is missing', () => {
    const envWithoutTrustProxy = { ...VALID_ENV }
    delete envWithoutTrustProxy.TRUST_PROXY

    let caught: unknown
    try {
      loadConfig(envWithoutTrustProxy)
    } catch (error) {
      caught = error
    }

    expect(caught).toBeInstanceOf(ValidationFailedError)
    if (!(caught instanceof ValidationFailedError)) return

    expect(caught.context.issues).toContainEqual({
      field: 'TRUST_PROXY',
      message: 'Missing required environment variable: TRUST_PROXY',
    })
  })

  it('rejects a non-numeric PORT', () => {
    expect(() => loadConfig({ ...VALID_ENV, PORT: 'not-a-number' })).toThrow(ValidationFailedError)
  })

  it.each([
    'ANALYSIS_QUEUE_CONCURRENCY',
    'DEEPGRAM_COST_PER_MINUTE_MICROS',
    'GEMINI_INPUT_COST_PER_MTOK_MICROS',
    'GEMINI_OUTPUT_COST_PER_MTOK_MICROS',
  ] as const)('rejects %s when it is zero', (key) => {
    expect(() => loadConfig({ ...VALID_ENV, [key]: '0' })).toThrow(ValidationFailedError)
  })

  it('lists REDIS_URL when it is missing', () => {
    const envWithoutRedisUrl = { ...VALID_ENV }
    delete envWithoutRedisUrl.REDIS_URL

    let caught: unknown
    try {
      loadConfig(envWithoutRedisUrl)
    } catch (error) {
      caught = error
    }

    expect(caught).toBeInstanceOf(ValidationFailedError)
    if (!(caught instanceof ValidationFailedError)) return

    expect(caught.context.issues).toContainEqual({
      field: 'REDIS_URL',
      message: 'Missing required environment variable: REDIS_URL',
    })
  })

  it('lists HOST when it is missing', () => {
    const envWithoutHost = { ...VALID_ENV }
    delete envWithoutHost.HOST

    let caught: unknown
    try {
      loadConfig(envWithoutHost)
    } catch (error) {
      caught = error
    }

    expect(caught).toBeInstanceOf(ValidationFailedError)
    if (!(caught instanceof ValidationFailedError)) return

    expect(caught.context.issues).toContainEqual({
      field: 'HOST',
      message: 'Missing required environment variable: HOST',
    })
  })

  it('lists PUBLIC_WEB_URL when it is missing', () => {
    const envWithoutPublicWebUrl = { ...VALID_ENV }
    delete envWithoutPublicWebUrl.PUBLIC_WEB_URL

    expect(() => loadConfig(envWithoutPublicWebUrl)).toThrow(ValidationFailedError)
  })
})

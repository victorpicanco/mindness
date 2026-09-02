import { Type } from '@fastify/type-provider-typebox'
import type { TLocalizedValidationError } from 'typebox/error'
import { Value } from 'typebox/value'

import type { FieldIssue } from '@/shared/errors/validation-failed-error/index.js'
import { ValidationFailedError } from '@/shared/errors/validation-failed-error/index.js'

const EnvSchema = Type.Object({
  NODE_ENV: Type.String(),
  HOST: Type.String(),
  PORT: Type.Integer(),
  WORKER_HEALTH_PORT: Type.Integer(),
  LOG_LEVEL: Type.String(),
  DATABASE_URL: Type.String(),
  PUBLIC_API_URL: Type.String(),
  PUBLIC_WEB_URL: Type.String(),
  SUPABASE_URL: Type.String(),
  SUPABASE_SECRET_KEY: Type.String(),
  EMAIL_CONFIRMATION_REDIRECT_URL: Type.String(),
  ACCOUNTS_CONSENT_VERSION: Type.String(),
  TRUST_PROXY: Type.Boolean(),
  REDIS_URL: Type.String(),
  DEEPGRAM_API_KEY: Type.String(),
  GOOGLE_CLOUD_PROJECT: Type.String(),
  GOOGLE_CLOUD_LOCATION: Type.String(),
  GEMINI_MODEL: Type.String(),
  DEEPGRAM_COST_PER_MINUTE_MICROS: Type.Integer({ minimum: 1 }),
  GEMINI_INPUT_COST_PER_MTOK_MICROS: Type.Integer({ minimum: 1 }),
  GEMINI_OUTPUT_COST_PER_MTOK_MICROS: Type.Integer({ minimum: 1 }),
  ANALYSIS_QUEUE_CONCURRENCY: Type.Integer({ minimum: 1 }),
  AUTH_RATE_LIMIT_MAX: Type.Integer({ minimum: 1 }),
  AUTH_RATE_LIMIT_WINDOW_MS: Type.Integer({ minimum: 1000 }),
})

const STRING_ENV_KEYS = [
  'NODE_ENV',
  'HOST',
  'LOG_LEVEL',
  'DATABASE_URL',
  'PUBLIC_API_URL',
  'PUBLIC_WEB_URL',
  'SUPABASE_URL',
  'SUPABASE_SECRET_KEY',
  'EMAIL_CONFIRMATION_REDIRECT_URL',
  'ACCOUNTS_CONSENT_VERSION',
  'REDIS_URL',
  'DEEPGRAM_API_KEY',
  'GOOGLE_CLOUD_PROJECT',
  'GOOGLE_CLOUD_LOCATION',
  'GEMINI_MODEL',
] as const
const BOOLEAN_ENV_KEYS = ['TRUST_PROXY'] as const
const NUMERIC_ENV_KEYS = [
  'PORT',
  'WORKER_HEALTH_PORT',
  'DEEPGRAM_COST_PER_MINUTE_MICROS',
  'GEMINI_INPUT_COST_PER_MTOK_MICROS',
  'GEMINI_OUTPUT_COST_PER_MTOK_MICROS',
  'ANALYSIS_QUEUE_CONCURRENCY',
  'AUTH_RATE_LIMIT_MAX',
  'AUTH_RATE_LIMIT_WINDOW_MS',
] as const

export interface Config {
  readonly nodeEnv: string
  readonly host: string
  readonly port: number
  readonly workerHealthPort: number
  readonly logLevel: string
  readonly databaseUrl: string
  readonly publicApiUrl: string
  readonly publicWebUrl: string
  readonly supabaseUrl: string
  readonly supabaseSecretKey: string
  readonly emailConfirmationRedirectUrl: string
  readonly accountsConsentVersion: string
  readonly trustProxy: boolean
  readonly redisUrl: string
  readonly deepgramApiKey: string
  readonly googleCloudProject: string
  readonly googleCloudLocation: string
  readonly geminiModel: string
  readonly deepgramCostPerMinuteMicros: number
  readonly geminiInputCostPerMtokMicros: number
  readonly geminiOutputCostPerMtokMicros: number
  readonly analysisQueueConcurrency: number
  readonly authRateLimitMax: number
  readonly authRateLimitWindowMs: number
}

function buildCandidate(env: NodeJS.ProcessEnv): Record<string, unknown> {
  const candidate: Record<string, unknown> = {}

  for (const key of STRING_ENV_KEYS) {
    const raw = env[key]
    if (raw !== undefined && raw !== '') candidate[key] = raw
  }

  for (const key of BOOLEAN_ENV_KEYS) {
    const raw = env[key]
    if (raw === undefined || raw === '') continue
    // An unparseable value stays a string so the schema reports it as invalid
    // instead of silently turning into false.
    candidate[key] = raw === 'true' ? true : raw === 'false' ? false : raw
  }

  for (const key of NUMERIC_ENV_KEYS) {
    const raw = env[key]
    if (raw === undefined || raw === '') continue
    const parsed = Number(raw)
    candidate[key] = Number.isFinite(parsed) ? parsed : raw
  }

  return candidate
}

function issuesFromValidationError(error: TLocalizedValidationError): FieldIssue[] {
  if (error.keyword === 'required') {
    return error.params.requiredProperties.map((field) => ({
      field,
      message: `Missing required environment variable: ${field}`,
    }))
  }

  const field = error.instancePath.replace(/^\//, '')
  return [{ field, message: `Environment variable ${field} is invalid` }]
}

export function loadConfig(env: NodeJS.ProcessEnv): Readonly<Config> {
  const candidate = buildCandidate(env)

  if (!Value.Check(EnvSchema, candidate)) {
    const issues = [...Value.Errors(EnvSchema, candidate)].flatMap(issuesFromValidationError)
    throw new ValidationFailedError(issues)
  }

  return Object.freeze({
    nodeEnv: candidate.NODE_ENV,
    host: candidate.HOST,
    port: candidate.PORT,
    workerHealthPort: candidate.WORKER_HEALTH_PORT,
    logLevel: candidate.LOG_LEVEL,
    databaseUrl: candidate.DATABASE_URL,
    publicApiUrl: candidate.PUBLIC_API_URL,
    publicWebUrl: candidate.PUBLIC_WEB_URL,
    supabaseUrl: candidate.SUPABASE_URL,
    supabaseSecretKey: candidate.SUPABASE_SECRET_KEY,
    emailConfirmationRedirectUrl: candidate.EMAIL_CONFIRMATION_REDIRECT_URL,
    accountsConsentVersion: candidate.ACCOUNTS_CONSENT_VERSION,
    trustProxy: candidate.TRUST_PROXY,
    redisUrl: candidate.REDIS_URL,
    deepgramApiKey: candidate.DEEPGRAM_API_KEY,
    googleCloudProject: candidate.GOOGLE_CLOUD_PROJECT,
    googleCloudLocation: candidate.GOOGLE_CLOUD_LOCATION,
    geminiModel: candidate.GEMINI_MODEL,
    deepgramCostPerMinuteMicros: candidate.DEEPGRAM_COST_PER_MINUTE_MICROS,
    geminiInputCostPerMtokMicros: candidate.GEMINI_INPUT_COST_PER_MTOK_MICROS,
    geminiOutputCostPerMtokMicros: candidate.GEMINI_OUTPUT_COST_PER_MTOK_MICROS,
    analysisQueueConcurrency: candidate.ANALYSIS_QUEUE_CONCURRENCY,
    authRateLimitMax: candidate.AUTH_RATE_LIMIT_MAX,
    authRateLimitWindowMs: candidate.AUTH_RATE_LIMIT_WINDOW_MS,
  })
}

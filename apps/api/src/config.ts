import { Type } from '@fastify/type-provider-typebox'
import type { TLocalizedValidationError } from 'typebox/error'
import { Value } from 'typebox/value'

import type { FieldIssue } from '@/shared/errors/validation-failed-error/index.js'
import { ValidationFailedError } from '@/shared/errors/validation-failed-error/index.js'

const EnvSchema = Type.Object({
  NODE_ENV: Type.String(),
  PORT: Type.Integer(),
  WORKER_HEALTH_PORT: Type.Integer(),
  LOG_LEVEL: Type.String(),
  DATABASE_URL: Type.String(),
})

const STRING_ENV_KEYS = ['NODE_ENV', 'LOG_LEVEL', 'DATABASE_URL'] as const
const NUMERIC_ENV_KEYS = ['PORT', 'WORKER_HEALTH_PORT'] as const

export interface Config {
  readonly nodeEnv: string
  readonly port: number
  readonly workerHealthPort: number
  readonly logLevel: string
  readonly databaseUrl: string
}

function buildCandidate(env: NodeJS.ProcessEnv): Record<string, unknown> {
  const candidate: Record<string, unknown> = {}

  for (const key of STRING_ENV_KEYS) {
    const raw = env[key]
    if (raw !== undefined && raw !== '') candidate[key] = raw
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
    port: candidate.PORT,
    workerHealthPort: candidate.WORKER_HEALTH_PORT,
    logLevel: candidate.LOG_LEVEL,
    databaseUrl: candidate.DATABASE_URL,
  })
}

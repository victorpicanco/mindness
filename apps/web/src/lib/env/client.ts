import { z } from 'zod'

import { EnvironmentError } from './errors'

const clientEnvSchema = z.object({
  apiBaseUrl: z.url({ protocol: /^https?$/ }).optional(),
  turnstileSiteKey: z.string().min(1).optional(),
})

export type ClientEnv = z.output<typeof clientEnvSchema>

export interface ClientEnvSource {
  readonly apiBaseUrl: string | undefined
  readonly turnstileSiteKey: string | undefined
}

const SOURCE_VARIABLE_NAMES: Readonly<Record<keyof ClientEnvSource, string>> = {
  apiBaseUrl: 'NEXT_PUBLIC_API_BASE_URL',
  turnstileSiteKey: 'NEXT_PUBLIC_TURNSTILE_SITE_KEY',
}

function blankToUndefined(value: string | undefined): string | undefined {
  return value === undefined || value.trim() === '' ? undefined : value
}

function variableName(path: PropertyKey | undefined): string {
  if (path === 'apiBaseUrl' || path === 'turnstileSiteKey') return SOURCE_VARIABLE_NAMES[path]

  return String(path)
}

export function parseClientEnv(source: ClientEnvSource): ClientEnv {
  const parsed = clientEnvSchema.safeParse({
    apiBaseUrl: blankToUndefined(source.apiBaseUrl),
    turnstileSiteKey: blankToUndefined(source.turnstileSiteKey),
  })

  if (parsed.success) return parsed.data

  throw new EnvironmentError(
    parsed.error.issues.map((issue) => variableName(issue.path[0])),
    parsed.error,
  )
}

// Next.js inlines a NEXT_PUBLIC_ variable only where the property is read
// literally, so these two reads cannot be folded into a loop or a helper.
export function clientEnv(): ClientEnv {
  return parseClientEnv({
    apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL,
    turnstileSiteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
  })
}

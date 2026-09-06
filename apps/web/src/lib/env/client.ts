import { z } from 'zod'

import { EnvironmentError } from './errors'

const clientEnvSchema = z.object({
  apiBaseUrl: z.url({ protocol: /^https?$/ }).optional(),
  supabaseUrl: z.url({ protocol: /^https?$/ }),
  turnstileSiteKey: z.string().min(1).optional(),
})

type ClientEnv = z.output<typeof clientEnvSchema>

interface ClientEnvSource {
  readonly apiBaseUrl: string | undefined
  readonly supabaseUrl: string | undefined
  readonly turnstileSiteKey: string | undefined
}

const SOURCE_VARIABLE_NAMES: Readonly<Record<keyof ClientEnvSource, string>> = {
  apiBaseUrl: 'NEXT_PUBLIC_API_BASE_URL',
  supabaseUrl: 'NEXT_PUBLIC_SUPABASE_URL',
  turnstileSiteKey: 'NEXT_PUBLIC_TURNSTILE_SITE_KEY',
}

function blankToUndefined(value: string | undefined): string | undefined {
  return value === undefined || value.trim() === '' ? undefined : value
}

function variableName(path: PropertyKey | undefined): string {
  if (path === 'apiBaseUrl' || path === 'supabaseUrl' || path === 'turnstileSiteKey') {
    return SOURCE_VARIABLE_NAMES[path]
  }

  return String(path)
}

export function parseClientEnv(source: ClientEnvSource): ClientEnv {
  const parsed = clientEnvSchema.safeParse({
    apiBaseUrl: blankToUndefined(source.apiBaseUrl),
    supabaseUrl: blankToUndefined(source.supabaseUrl),
    turnstileSiteKey: blankToUndefined(source.turnstileSiteKey),
  })

  if (parsed.success) return parsed.data

  throw new EnvironmentError(
    parsed.error.issues.map((issue) => variableName(issue.path[0])),
    parsed.error,
  )
}
export function clientEnv(): ClientEnv {
  return parseClientEnv({
    apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    turnstileSiteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
  })
}

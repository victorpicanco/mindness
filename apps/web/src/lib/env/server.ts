import 'server-only'

import { z } from 'zod'

import { EnvironmentError } from './errors'
const serverEnvSchema = z.object({
  API_BASE_URL: z.url({ protocol: /^https?$/ }),
})

type ServerEnv = z.output<typeof serverEnvSchema>

type EnvSource = Readonly<Partial<Record<string, string>>>

function blankToUndefined(value: string | undefined): string | undefined {
  return value === undefined || value.trim() === '' ? undefined : value
}

export function readServerEnv(source: EnvSource = process.env): ServerEnv {
  const parsed = serverEnvSchema.safeParse({
    API_BASE_URL: blankToUndefined(source.API_BASE_URL),
  })

  if (parsed.success) return parsed.data

  throw new EnvironmentError(
    parsed.error.issues.map((issue) => issue.path.join('.')),
    parsed.error,
  )
}

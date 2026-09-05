import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import { Type } from '@fastify/type-provider-typebox'
import type { TLocalizedValidationError } from 'typebox/error'
import { Value } from 'typebox/value'

import { createThemesContainer } from '@/modules/themes/index.js'
import { createPrismaClient } from '@/shared/database/prisma-client/index.js'
import {
  ValidationFailedError,
  type FieldIssue,
} from '@/shared/errors/validation-failed-error/index.js'
import { UuidGenerator } from '@/shared/id/uuid-generator/index.js'
import { createLogger } from '@/shared/logger/pino-logger/index.js'
import { InProcessEventBus } from '@/shared/messaging/in-process-event-bus/index.js'
import { SystemClock } from '@/shared/time/system-clock/index.js'

const SyncEnvSchema = Type.Object({
  NODE_ENV: Type.String(),
  LOG_LEVEL: Type.String(),
  DATABASE_URL: Type.String(),
})

const ThemeCatalogSchema = Type.Object(
  {
    categories: Type.Array(
      Type.Object(
        {
          slug: Type.String(),
          name: Type.String(),
          themes: Type.Array(
            Type.Object(
              {
                title: Type.String(),
                difficulty: Type.Union([
                  Type.Literal('easy'),
                  Type.Literal('balanced'),
                  Type.Literal('hard'),
                ]),
                publicationStatus: Type.Union([
                  Type.Literal('draft'),
                  Type.Literal('published'),
                  Type.Literal('withdrawn'),
                ]),
              },
              { additionalProperties: false },
            ),
          ),
        },
        { additionalProperties: false },
      ),
    ),
  },
  { additionalProperties: false },
)

type ThemeCatalogUseCases = ReturnType<typeof createThemesContainer>['useCases']
type CatalogSyncResult = Awaited<
  ReturnType<ThemeCatalogUseCases['synchronizeThemeCatalog']['execute']>
>

export interface CatalogReport {
  readonly lines: readonly string[]
  readonly hasFindings: boolean
}

function issuesFromValidationError(error: TLocalizedValidationError): FieldIssue[] {
  const field = error.instancePath.replace(/^\//, '').replace(/\//g, '.')

  return [{ field: field || 'catalog', message: `Theme catalog ${field || 'catalog'} is invalid` }]
}

function issuesFromEnvValidationError(error: TLocalizedValidationError): FieldIssue[] {
  if (error.keyword === 'required') {
    return error.params.requiredProperties.map((field) => ({
      field,
      message: `Missing required environment variable: ${field}`,
    }))
  }

  const field = error.instancePath.replace(/^\//, '')
  return [{ field, message: `Environment variable ${field} is invalid` }]
}

export async function synchronizeThemeCatalog(
  catalog: unknown,
  useCases: Pick<ThemeCatalogUseCases, 'synchronizeThemeCatalog'>,
): Promise<CatalogSyncResult> {
  if (!Value.Check(ThemeCatalogSchema, catalog)) {
    throw new ValidationFailedError(
      Value.Errors(ThemeCatalogSchema, catalog).flatMap(issuesFromValidationError),
    )
  }

  return useCases.synchronizeThemeCatalog.execute(catalog)
}

export function buildCatalogReport(result: CatalogSyncResult): CatalogReport {
  const poolLines = result.poolReports.map(
    (report) =>
      `pool  ${report.categorySlug} / ${report.difficulty}: ${report.publishedCount}/${report.minimum} published`,
  )
  const divergenceLines = result.divergences.map(
    (divergence) =>
      `drift ${divergence.categorySlug} / "${divergence.title}": manual withdrawal preserved`,
  )

  return {
    lines: [...poolLines, ...divergenceLines],
    hasFindings:
      result.divergences.length > 0 ||
      result.poolReports.some((report) => report.publishedCount < report.minimum),
  }
}

// The catalog sync reaches only the database, so it validates the three variables
// it reads instead of the full application config — a migration runner has no
// reason to carry the Deepgram, Gemini or Supabase credentials.
function loadSyncEnv(env: NodeJS.ProcessEnv): {
  readonly nodeEnv: string
  readonly logLevel: string
  readonly databaseUrl: string
} {
  const candidate: Record<string, unknown> = {
    NODE_ENV: env.NODE_ENV ?? 'development',
    LOG_LEVEL: env.LOG_LEVEL ?? 'info',
    ...(env.DATABASE_URL === undefined || env.DATABASE_URL === ''
      ? {}
      : { DATABASE_URL: env.DATABASE_URL }),
  }

  if (!Value.Check(SyncEnvSchema, candidate)) {
    throw new ValidationFailedError(
      [...Value.Errors(SyncEnvSchema, candidate)].flatMap(issuesFromEnvValidationError),
    )
  }

  return {
    nodeEnv: candidate.NODE_ENV,
    logLevel: candidate.LOG_LEVEL,
    databaseUrl: candidate.DATABASE_URL,
  }
}

async function run(): Promise<void> {
  const config = loadSyncEnv(process.env)
  const logger = createLogger({ level: config.logLevel, pretty: config.nodeEnv !== 'production' })
  const prisma = createPrismaClient({
    databaseUrl: config.databaseUrl,
    logQueries: config.nodeEnv !== 'production',
  })
  const container = createThemesContainer({
    prisma,
    clock: new SystemClock(),
    eventPublisher: new InProcessEventBus(logger),
    idGenerator: new UuidGenerator(),
  })

  try {
    const catalogPath = new URL('../prisma/catalog/themes.json', import.meta.url)
    const catalog: unknown = JSON.parse(await readFile(catalogPath, 'utf8'))
    const report = buildCatalogReport(await synchronizeThemeCatalog(catalog, container.useCases))
    for (const line of report.lines) console.log(line)
    if (report.hasFindings) process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
}

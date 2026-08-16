import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import { Type } from '@fastify/type-provider-typebox'
import { Value } from 'typebox/value'

import { loadConfig } from '@/config.js'
import {
  createThemesContainer,
  type ThemesContainer,
} from '@/modules/themes/composition/container.js'
import type { SynchronizeThemeCatalogOutput } from '@/modules/themes/application/use-cases/synchronize-theme-catalog/index.js'
import { createPrismaClient } from '@/shared/database/prisma-client/index.js'
import { UuidGenerator } from '@/shared/id/uuid-generator/index.js'
import { createLogger } from '@/shared/logger/pino-logger/index.js'
import { InProcessEventBus } from '@/shared/messaging/in-process-event-bus/index.js'
import { SystemClock } from '@/shared/time/system-clock/index.js'

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

type ThemeCatalogUseCases = ThemesContainer['useCases']

export async function synchronizeThemeCatalog(
  catalog: unknown,
  useCases: Pick<ThemeCatalogUseCases, 'synchronizeThemeCatalog'>,
): Promise<SynchronizeThemeCatalogOutput> {
  if (!Value.Check(ThemeCatalogSchema, catalog)) {
    throw new TypeError('The theme catalog has an invalid structure')
  }

  return useCases.synchronizeThemeCatalog.execute(catalog)
}

function printPoolReports(result: SynchronizeThemeCatalogOutput): void {
  for (const report of result.poolReports) {
    console.log(
      `${report.categorySlug} / ${report.difficulty}: ${report.publishedCount}/${report.minimum} published`,
    )
  }
}

async function run(): Promise<void> {
  const config = loadConfig(process.env)
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
    const result = await synchronizeThemeCatalog(catalog, container.useCases)
    printPoolReports(result)
    if (result.poolReports.some((report) => report.publishedCount < report.minimum)) {
      process.exitCode = 1
    }
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

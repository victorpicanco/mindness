import { PrismaPg } from '@prisma/adapter-pg'

import { PrismaClient } from '@/generated/prisma/client.js'
import { assertConnectionTls } from '@/shared/database/connection-tls/index.js'

export function createPrismaClient(config: {
  databaseUrl: string
  logQueries: boolean
}): PrismaClient {
  assertConnectionTls(config.databaseUrl)

  const adapter = new PrismaPg({ connectionString: config.databaseUrl })

  return new PrismaClient({
    adapter,
    log: config.logQueries ? ['query'] : [],
  })
}

import { PrismaPg } from '@prisma/adapter-pg'

import { PrismaClient } from '@/generated/prisma/client.js'

export function createPrismaClient(config: {
  databaseUrl: string
  logQueries: boolean
}): PrismaClient {
  const adapter = new PrismaPg({ connectionString: config.databaseUrl })

  return new PrismaClient({
    adapter,
    log: config.logQueries ? ['query'] : [],
  })
}

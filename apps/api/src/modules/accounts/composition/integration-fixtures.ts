import type { PrismaClient } from '@/generated/prisma/client.js'

const ACCOUNTS_TABLES = ['accounts', 'account_deletion_requests']

export function clearAccountsData(prisma: PrismaClient): Promise<number> {
  return prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${ACCOUNTS_TABLES.join(', ')} RESTART IDENTITY CASCADE`,
  )
}

export {
  assertResponseMatchesSchema,
  type InjectedResponse,
} from '@/shared/http/openapi-response-assertion/index.js'

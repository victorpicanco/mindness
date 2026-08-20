import type { PrismaClient } from '@/generated/prisma/client.js'
import { Account } from '@/modules/accounts/domain/entities/account/index.js'
import type { AccountsRepository } from '@/modules/accounts/domain/repositories/accounts-repository/index.js'
import { EmailAddress } from '@/modules/accounts/domain/value-objects/email-address/index.js'
import { TimeZone } from '@/modules/accounts/domain/value-objects/time-zone/index.js'
import { UuidGenerator } from '@/shared/id/uuid-generator/index.js'

const ACCOUNTS_TABLES = ['accounts', 'account_deletion_requests']

export function clearAccountsData(prisma: PrismaClient): Promise<number> {
  return prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${ACCOUNTS_TABLES.join(', ')} RESTART IDENTITY CASCADE`,
  )
}

export async function seedAccounts(
  accounts: AccountsRepository,
  total: number,
  createdAt: Date,
): Promise<void> {
  const ids = new UuidGenerator()

  for (let index = 0; index < total; index += 1) {
    await accounts.save(
      Account.create({
        id: ids.generate(),
        email: EmailAddress.create(`seed-${index}@example.com`),
        authUserId: `seed-auth-user-${index}`,
        timeZone: TimeZone.create('America/Sao_Paulo'),
        createdAt,
      }),
    )
  }
}

export {
  assertResponseMatchesSchema,
  type InjectedResponse,
} from '@/shared/http/openapi-response-assertion/index.js'

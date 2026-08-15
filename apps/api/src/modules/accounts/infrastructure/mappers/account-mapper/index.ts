import { Account } from '../../../domain/entities/account/index.js'
import type { AccountRow } from '../../clients/accounts-prisma-client/index.js'

export class AccountMapper {
  toDomain(row: AccountRow): Account {
    return Account.create({
      id: row.id,
      email: row.email,
      authUserId: row.authUserId,
      timeZone: row.timeZone,
      createdAt: row.createdAt,
    })
  }

  toPersistence(account: Account): AccountRow {
    return {
      id: account.id,
      email: account.email,
      authUserId: account.authUserId,
      timeZone: account.timeZone,
      plan: account.plan,
      status: account.status,
      createdAt: account.createdAt,
    }
  }
}

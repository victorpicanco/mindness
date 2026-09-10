import { readFile } from 'node:fs/promises'

import type { PrismaClient } from '@/generated/prisma/client.js'
import { OperationFailedError } from '@/shared/errors/operation-failed-error/index.js'

const ACCOUNTS_TABLES = ['accounts', 'account_deletion_requests']

export function clearAccountsData(prisma: PrismaClient): Promise<number> {
  return prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${ACCOUNTS_TABLES.join(', ')} RESTART IDENTITY CASCADE`,
  )
}

interface AccountMigrationRow {
  readonly email: string
  readonly kind: string
}

function isAccountMigrationRows(value: unknown): value is AccountMigrationRow[] {
  return (
    Array.isArray(value) &&
    value.every(
      (row: unknown) =>
        typeof row === 'object' &&
        row !== null &&
        'email' in row &&
        typeof row.email === 'string' &&
        'kind' in row &&
        typeof row.kind === 'string',
    )
  )
}

export async function applyGuestAccountsMigrationToLegacyRows(
  prisma: PrismaClient,
): Promise<readonly AccountMigrationRow[]> {
  const migration = await readFile(
    new URL(
      '../../../../prisma/migrations/20260910120000_add_guest_accounts/migration.sql',
      import.meta.url,
    ),
    'utf8',
  )
  const statements = migration
    .split(';')
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0)

  return prisma.$transaction(async (transaction) => {
    await transaction.$executeRawUnsafe('DROP SCHEMA IF EXISTS accounts_migration_test CASCADE')
    await transaction.$executeRawUnsafe('CREATE SCHEMA accounts_migration_test')
    await transaction.$executeRawUnsafe('SET LOCAL search_path TO accounts_migration_test')
    await transaction.$executeRawUnsafe(`
      CREATE TABLE accounts (
        id UUID PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        auth_user_id TEXT NOT NULL UNIQUE
      )
    `)
    await transaction.$executeRawUnsafe(`
      INSERT INTO accounts (id, email, auth_user_id)
      VALUES ('00000000-0000-4000-8000-000000000091', 'legacy@example.com', 'legacy-user')
    `)
    for (const statement of statements) await transaction.$executeRawUnsafe(statement)

    const rows: unknown = await transaction.$queryRawUnsafe(
      'SELECT email, kind::text AS kind FROM accounts ORDER BY id',
    )
    if (!isAccountMigrationRows(rows)) {
      throw new OperationFailedError('validate-account-migration-result')
    }

    await transaction.$executeRawUnsafe('SET LOCAL search_path TO public')
    await transaction.$executeRawUnsafe('DROP SCHEMA accounts_migration_test CASCADE')
    return rows
  })
}

export function insertAccountForConstraintCheck(
  prisma: PrismaClient,
  input: {
    readonly id: string
    readonly kind: 'guest' | 'registered'
    readonly email: string | null
    readonly authUserId: string
  },
): Promise<number> {
  return prisma.$executeRaw`
    INSERT INTO accounts (id, kind, email, auth_user_id, time_zone, plan, status, created_at)
    VALUES (${input.id}::uuid, ${input.kind}::account_kind, ${input.email}, ${input.authUserId},
            'America/Sao_Paulo', 'free', 'accessible', NOW())
  `
}

export {
  assertResponseMatchesSchema,
  type InjectedResponse,
} from '@/shared/http/openapi-response-assertion/index.js'

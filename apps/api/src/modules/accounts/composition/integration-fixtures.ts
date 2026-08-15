import { Ajv } from 'ajv'
import addFormats from 'ajv-formats'
import type { FastifyInstance } from 'fastify'

import type { PrismaClient } from '@/generated/prisma/client.js'
import { Account } from '@/modules/accounts/domain/entities/account/index.js'
import type { AccountsRepository } from '@/modules/accounts/domain/repositories/accounts-repository/index.js'
import { EmailAddress } from '@/modules/accounts/domain/value-objects/email-address/index.js'
import { TimeZone } from '@/modules/accounts/domain/value-objects/time-zone/index.js'
import { OperationFailedError } from '@/shared/errors/operation-failed-error/index.js'
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readPath(value: unknown, path: readonly (string | number)[]): unknown {
  let current = value

  for (const key of path) {
    if (!isRecord(current)) return undefined
    current = current[key]
  }

  return current
}

// ajv-formats ships CommonJS, so the callable plugin sits behind `.default` under NodeNext.
function buildValidator(): Ajv {
  return addFormats.default(new Ajv({ strict: false, allErrors: true }))
}

export interface InjectedResponse {
  json(): unknown
}

const validators = new WeakMap<FastifyInstance, Ajv>()

// LAW-011.13: the OpenAPI document the frontend consumes is the contract, so every response is
// re-validated against the schema the route declared for the status code it answered with.
export function assertResponseMatchesSchema(
  app: FastifyInstance,
  method: string,
  route: string,
  response: InjectedResponse,
  statusCode: number,
): void {
  const specification: unknown = app.swagger()
  const schema = readPath(specification, [
    'paths',
    route,
    method.toLowerCase(),
    'responses',
    String(statusCode),
    'content',
    'application/json',
    'schema',
  ])

  if (!isRecord(schema)) {
    throw new OperationFailedError('The route declares no schema for this status code', {
      context: { route, method, statusCode },
    })
  }

  const ajv = validators.get(app) ?? buildValidator()
  validators.set(app, ajv)

  const validate = ajv.compile(schema)
  const body: unknown = response.json()

  if (!validate(body)) {
    throw new OperationFailedError('The response does not match the declared OpenAPI schema', {
      context: { route, method, statusCode, errors: validate.errors },
    })
  }
}

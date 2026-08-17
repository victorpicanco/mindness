import { describe, expect, it } from 'vitest'

import type { PrismaClient } from '@/generated/prisma/client.js'

import type { QuotaPrismaClient, QuotaPrismaTransactionRunner } from './index.js'

// The real assertion here is the compilation: the container injects the generated client into the
// repositories and the unit of work, and a shape it does not satisfy only fails once composition
// exists, many tasks after it was written.
function acceptGeneratedClient(
  prisma: PrismaClient,
): QuotaPrismaClient & QuotaPrismaTransactionRunner {
  return prisma
}

describe('QuotaPrismaClient', () => {
  it('is structurally satisfied by the generated Prisma client', () => {
    expect(acceptGeneratedClient).toBeTypeOf('function')
  })
})

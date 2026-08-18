import { describe, expect, it } from 'vitest'

import type { PrismaClient } from '@/generated/prisma/client.js'

import type { QuotaPrismaClient, QuotaPrismaTransactionRunner } from './index.js'

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

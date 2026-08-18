import { describe, expect, it } from 'vitest'

import type { PrismaClient } from '@/generated/prisma/client.js'

import type { ThemesPrismaClient, ThemesPrismaTransactionRunner } from './index.js'

type AssignableTo<TSource extends TTarget, TTarget> = TSource
type GeneratedClientCoversThemes = AssignableTo<
  PrismaClient,
  ThemesPrismaClient & ThemesPrismaTransactionRunner
>

const generatedClientCoversThemes: GeneratedClientCoversThemes | null = null

describe('ThemesPrismaClient', () => {
  it('is satisfied by the generated Prisma client', () => {
    expect(generatedClientCoversThemes).toBeNull()
  })
})

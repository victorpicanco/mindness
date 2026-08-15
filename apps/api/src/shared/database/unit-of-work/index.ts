import type { PrismaClient } from '@/generated/prisma/client.js'

export interface UnitOfWork {
  run<T>(fn: () => Promise<T>): Promise<T>
}

export class PrismaUnitOfWork implements UnitOfWork {
  constructor(private readonly prisma: PrismaClient) {}

  run<T>(fn: () => Promise<T>): Promise<T> {
    return this.prisma.$transaction(() => fn())
  }
}

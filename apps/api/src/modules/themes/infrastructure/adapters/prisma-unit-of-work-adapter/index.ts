import type { UnitOfWork } from '@/modules/themes/domain/ports/unit-of-work/index.js'
import type { ThemesPrismaTransactionRunner } from '@/modules/themes/infrastructure/clients/themes-prisma-client/index.js'
import type { ThemesTransactionContext } from '@/modules/themes/infrastructure/clients/themes-transaction-context/index.js'

// Prisma's default interactive-transaction timeout is 5000ms. The catalog sync
// walks every entry sequentially inside this transaction, and the 2026-09-05
// staging run failed with P2028 after 6181ms on a 640-theme catalog. This
// leaves headroom for the catalog to keep growing.
export const THEME_CATALOG_SYNC_TRANSACTION_TIMEOUT_MS = 120_000

export class PrismaUnitOfWorkAdapter implements UnitOfWork {
  constructor(
    private readonly prisma: ThemesPrismaTransactionRunner,
    private readonly transactionContext: ThemesTransactionContext,
  ) {}

  run<T>(operation: () => Promise<T>): Promise<T> {
    return this.prisma.$transaction(
      (transaction) => this.transactionContext.run(transaction, operation),
      { isolationLevel: 'Serializable', timeout: THEME_CATALOG_SYNC_TRANSACTION_TIMEOUT_MS },
    )
  }
}

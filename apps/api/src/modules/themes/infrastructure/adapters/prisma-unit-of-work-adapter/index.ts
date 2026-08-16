import type { UnitOfWork } from '@/modules/themes/domain/ports/unit-of-work/index.js'
import type { ThemesPrismaTransactionRunner } from '@/modules/themes/infrastructure/clients/themes-prisma-client/index.js'
import type { ThemesTransactionContext } from '@/modules/themes/infrastructure/clients/themes-transaction-context/index.js'

export class PrismaUnitOfWorkAdapter implements UnitOfWork {
  constructor(
    private readonly prisma: ThemesPrismaTransactionRunner,
    private readonly transactionContext: ThemesTransactionContext,
  ) {}

  run<T>(operation: () => Promise<T>): Promise<T> {
    return this.prisma.$transaction(
      (transaction) => this.transactionContext.run(transaction, operation),
      { isolationLevel: 'Serializable' },
    )
  }
}

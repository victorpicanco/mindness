import type { UnitOfWork } from '@/modules/analyses/domain/ports/unit-of-work/index.js'
import type { AnalysesPrismaTransactionRunner } from '@/modules/analyses/infrastructure/clients/analyses-prisma-client/index.js'
import type { AnalysesTransactionContext } from '@/modules/analyses/infrastructure/clients/analyses-transaction-context/index.js'

export class PrismaUnitOfWorkAdapter implements UnitOfWork {
  constructor(
    private readonly prisma: AnalysesPrismaTransactionRunner,
    private readonly context: AnalysesTransactionContext,
  ) {}
  run<T>(operation: () => Promise<T>): Promise<T> {
    return this.prisma.$transaction((transaction) => this.context.run(transaction, operation), {
      isolationLevel: 'Serializable',
    })
  }
}

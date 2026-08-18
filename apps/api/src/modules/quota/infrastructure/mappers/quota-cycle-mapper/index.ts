import { QuotaCycle } from '@/modules/quota/domain/entities/quota-cycle/index.js'
import { CycleWindow } from '@/modules/quota/domain/value-objects/cycle-window/index.js'
import type { QuotaCycleRow } from '@/modules/quota/infrastructure/clients/quota-prisma-client/index.js'

export class QuotaCycleMapper {
  toDomain(row: QuotaCycleRow): QuotaCycle {
    return QuotaCycle.reconstitute({
      id: row.id,
      accountId: row.accountId,
      sequence: row.sequence,
      window: CycleWindow.reconstitute(row.startsAt, row.renewsAt),
      allowance: row.allowance,
      carriedUsage: row.carriedUsage,
      createdAt: row.createdAt,
    })
  }

  toPersistence(cycle: QuotaCycle): QuotaCycleRow {
    return {
      id: cycle.id,
      accountId: cycle.accountId,
      sequence: cycle.sequence,
      startsAt: cycle.window.startsAt,
      renewsAt: cycle.window.renewsAt,
      allowance: cycle.allowance,
      carriedUsage: cycle.carriedUsage,
      createdAt: cycle.createdAt,
    }
  }
}

import type { QuotaCycle } from '@/modules/quota/domain/entities/quota-cycle/index.js'

export interface QuotaCyclesRepository {
  findCurrent(accountId: string, at: Date): Promise<QuotaCycle | null>
  findLatest(accountId: string): Promise<QuotaCycle | null>
  save(cycle: QuotaCycle): Promise<void>
}

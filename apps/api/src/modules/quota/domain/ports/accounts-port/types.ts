import type { QuotaPlan } from '@/modules/quota/domain/services/quota-policy/index.js'

export interface QuotaAccount {
  readonly accountId: string
  readonly plan: QuotaPlan
  readonly createdAt: Date
}

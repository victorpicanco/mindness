import type { Analysis } from '@/modules/analyses/domain/entities/analysis/index.js'

export interface AnalysesRepository {
  findBySessionId(sessionId: string): Promise<Analysis | null>
  save(analysis: Analysis): Promise<void>
}

import type { Analysis } from '@/modules/analyses/domain/entities/analysis/index.js'

export interface AnalysesRepository {
  findBySessionId(sessionId: string): Promise<Analysis | null>
  markFirstView(sessionId: string, at: Date): Promise<boolean>
  save(analysis: Analysis): Promise<void>
}

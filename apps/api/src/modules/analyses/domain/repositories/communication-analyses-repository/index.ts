import type { CommunicationAnalysis } from '@/modules/analyses/domain/entities/communication-analysis/index.js'

export interface CommunicationAnalysesRepository {
  findBySessionId(sessionId: string): Promise<CommunicationAnalysis | null>
  save(analysis: CommunicationAnalysis): Promise<void>
}

import type { GetSessionAnalysisController } from '@/modules/analyses/presentation/controllers/get-session-analysis-controller/index.js'

export interface AnalysesControllers {
  readonly getSessionAnalysis: GetSessionAnalysisController
}

export const ANALYSES_ROUTE_PATHS = {
  sessionAnalysis: '/sessions/:sessionId/analysis',
} as const

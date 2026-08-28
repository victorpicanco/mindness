export interface SessionProcessingContext {
  readonly sessionId: string
  readonly accountId: string
  readonly themeId: string
  readonly audioPath: string
  readonly recordedAt: Date
}

export type AnalysisFailure = 'analysis_failed' | 'analysis_timeout'

export interface AnalysisAccess {
  readonly readable: boolean
  readonly failure: AnalysisFailure | null
}

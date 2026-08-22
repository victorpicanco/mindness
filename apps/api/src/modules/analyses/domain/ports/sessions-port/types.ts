export interface SessionProcessingContext {
  readonly sessionId: string
  readonly accountId: string
  readonly themeId: string
  readonly audioPath: string
  readonly recordedAt: Date
}

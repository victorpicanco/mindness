export interface FindSessionProcessingContextInput {
  readonly sessionId: string
}
export interface SessionForProcessingContext {
  readonly id: string
  readonly accountId: string
  readonly themeId: string
  readonly audio: { readonly storagePath: string } | null
  readonly recordedAt: Date | null
}
export interface FindSessionProcessingContextDependencies {
  readonly sessions: { findById(sessionId: string): Promise<SessionForProcessingContext | null> }
}
export interface SessionProcessingContext {
  readonly sessionId: string
  readonly accountId: string
  readonly themeId: string
  readonly audioPath: string
  readonly recordedAt: Date
}

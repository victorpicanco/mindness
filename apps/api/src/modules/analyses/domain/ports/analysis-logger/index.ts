export interface AnalysisLogger {
  warn(
    context: { readonly totalMicros: number },
    message: 'monthly_cost_alert_threshold_reached',
  ): void
  warn(
    context: { readonly sessionId: string; readonly accountId?: string },
    message: 'analysis_target_missing',
  ): void
  warn(context: { readonly eventId: string }, message: 'recording_submitted_payload_rejected'): void
}

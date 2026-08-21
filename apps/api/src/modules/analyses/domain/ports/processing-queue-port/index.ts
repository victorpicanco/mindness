export interface ProcessingQueuePort {
  enqueue(input: { readonly sessionId: string }): Promise<void>
}

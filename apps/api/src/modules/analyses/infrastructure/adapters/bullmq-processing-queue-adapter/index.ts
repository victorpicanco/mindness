import type { JobsOptions } from 'bullmq'

import type { ProcessingQueuePort } from '@/modules/analyses/domain/ports/processing-queue-port/index.js'

type SessionAnalysisJob = {
  readonly sessionId: string
}

interface BullMqQueue {
  add(name: string, data: SessionAnalysisJob, options: JobsOptions): Promise<unknown>
}

const SESSION_ANALYSIS_JOB_NAME = 'session-analysis'
const MAX_JOB_ATTEMPTS = 2
const RETRY_DELAY_MS = 5_000
const COMPLETED_JOBS_TO_KEEP = 1_000
const FAILED_JOBS_TO_KEEP = 5_000

export class BullMqProcessingQueueAdapter implements ProcessingQueuePort {
  constructor(private readonly queue: BullMqQueue) {}

  async enqueue(input: { readonly sessionId: string }): Promise<void> {
    await this.queue.add(SESSION_ANALYSIS_JOB_NAME, input, {
      jobId: input.sessionId,
      attempts: MAX_JOB_ATTEMPTS,
      backoff: { type: 'exponential', delay: RETRY_DELAY_MS },
      removeOnComplete: { count: COMPLETED_JOBS_TO_KEEP },
      removeOnFail: { count: FAILED_JOBS_TO_KEEP },
    })
  }
}

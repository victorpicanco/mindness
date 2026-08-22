import { describe, expect, it } from 'vitest'

import { BullMqProcessingQueueAdapter } from './index.js'

type SessionAnalysisJob = {
  readonly sessionId: string
}

type QueueCall = {
  readonly name: string
  readonly data: SessionAnalysisJob
  readonly options: {
    readonly jobId: string
    readonly attempts: number
    readonly backoff: { readonly type: string; readonly delay: number }
    readonly removeOnComplete: { readonly count: number }
    readonly removeOnFail: { readonly count: number }
  }
}

class FakeQueue {
  readonly calls: QueueCall[] = []

  add(name: string, data: SessionAnalysisJob, options: QueueCall['options']): Promise<void> {
    this.calls.push({ name, data, options })
    return Promise.resolve()
  }
}

describe('BullMqProcessingQueueAdapter', () => {
  it('enqueues a session analysis job with retry and retention options', async () => {
    const queue = new FakeQueue()
    const adapter = new BullMqProcessingQueueAdapter(queue)

    await adapter.enqueue({ sessionId: 'session-1' })

    expect(queue.calls).toEqual([
      {
        name: 'session-analysis',
        data: { sessionId: 'session-1' },
        options: {
          jobId: 'session-1',
          attempts: 2,
          backoff: { type: 'exponential', delay: 5_000 },
          removeOnComplete: { count: 1_000 },
          removeOnFail: { count: 5_000 },
        },
      },
    ])
  })
})

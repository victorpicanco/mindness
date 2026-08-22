import { describe, expect, it } from 'vitest'

import { EvaluationFailedError } from '@/modules/analyses/domain/errors/evaluation-failed-error/index.js'

import { InMemoryProcessingQueueAdapter } from './index.js'

describe('InMemoryProcessingQueueAdapter', () => {
  it('records an enqueued session', async () => {
    const adapter = new InMemoryProcessingQueueAdapter()

    await adapter.enqueue({ sessionId: 'session-1' })

    expect(adapter.enqueued).toEqual([{ sessionId: 'session-1' }])
  })

  it('fails the next enqueue', async () => {
    const adapter = new InMemoryProcessingQueueAdapter()
    adapter.failNext(new EvaluationFailedError('unavailable'))

    await expect(adapter.enqueue({ sessionId: 'session-1' })).rejects.toMatchObject({
      code: 'analyses.EVALUATION_FAILED',
    })
    expect(adapter.enqueued).toEqual([])
  })
})

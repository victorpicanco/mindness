import { Queue } from 'bullmq'
import { Redis } from 'ioredis'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'

import { BullMqProcessingQueueAdapter } from '@/modules/analyses/infrastructure/adapters/bullmq-processing-queue-adapter/index.js'

const QUEUE_NAME = 'session-analysis'

let connection: Redis
let queue: Queue
let adapter: BullMqProcessingQueueAdapter

beforeAll(() => {
  connection = new Redis(inject('redisUrl'), { maxRetriesPerRequest: null })
  queue = new Queue(QUEUE_NAME, { connection })
  adapter = new BullMqProcessingQueueAdapter(queue)
})

afterAll(async () => {
  await queue.close()
  connection.disconnect()
})

describe('BullMqProcessingQueueAdapter integration', () => {
  it('persists a job with jobId equal to the session id and the retry/retention options', async () => {
    const sessionId = '00000000-0000-0000-0000-000000000101'

    await adapter.enqueue({ sessionId })

    const job = await queue.getJob(sessionId)

    expect(job?.id).toBe(sessionId)
    expect(job?.opts.attempts).toBe(2)
    expect(job?.opts.backoff).toEqual({ type: 'exponential', delay: 5_000 })
    expect(job?.opts.removeOnComplete).toEqual({ count: 1_000 })
    expect(job?.opts.removeOnFail).toEqual({ count: 5_000 })
  })

  it('keeps a single job in the queue when the same session is enqueued twice', async () => {
    const sessionId = '00000000-0000-0000-0000-000000000102'

    await adapter.enqueue({ sessionId })
    await adapter.enqueue({ sessionId })

    const jobs = await queue.getJobs(['waiting', 'delayed'])
    const matching = jobs.filter((job) => job.id === sessionId)

    expect(matching).toHaveLength(1)
  })
})

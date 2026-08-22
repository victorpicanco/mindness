import type { AnalysisLogger } from '@/modules/analyses/domain/ports/analysis-logger/index.js'
import type { IntegrationEvent } from '@/shared/messaging/integration-event/index.js'
import { describe, expect, it } from 'vitest'

import { OnRecordingSubmittedEnqueueAnalysis } from './index.js'

class FakeEnqueueSessionAnalysisUseCase {
  readonly received: { readonly sessionId: string; readonly accountId: string }[] = []

  execute(input: { readonly sessionId: string; readonly accountId: string }): Promise<void> {
    this.received.push(input)
    return Promise.resolve()
  }
}

function isEventIdContext(value: unknown): value is { readonly eventId: string } {
  return typeof value === 'object' && value !== null && 'eventId' in value
}

class InMemoryAnalysisLogger implements AnalysisLogger {
  readonly rejectedPayloads: { readonly eventId: string }[] = []

  warn(context: unknown): void {
    if (isEventIdContext(context)) this.rejectedPayloads.push(context)
  }
}

function createEvent(payload: unknown): IntegrationEvent<string, unknown> {
  return {
    eventId: 'event-1',
    eventName: 'recording_submitted',
    occurredAt: new Date('2026-08-21T15:30:00.000Z'),
    version: 1,
    payload,
  }
}

describe('OnRecordingSubmittedEnqueueAnalysis', () => {
  it('enqueues the session identified by a recording submitted event', async () => {
    const useCase = new FakeEnqueueSessionAnalysisUseCase()
    const handler = new OnRecordingSubmittedEnqueueAnalysis(useCase, new InMemoryAnalysisLogger())

    await handler.handle(
      createEvent({ sessionId: 'session-1', accountId: 'account-1', durationSeconds: 90 }),
    )

    expect(useCase.received).toEqual([{ sessionId: 'session-1', accountId: 'account-1' }])
  })

  it('rejects an unexpected payload without invoking the use case, and logs it', async () => {
    const useCase = new FakeEnqueueSessionAnalysisUseCase()
    const logger = new InMemoryAnalysisLogger()
    const handler = new OnRecordingSubmittedEnqueueAnalysis(useCase, logger)

    await handler.handle(createEvent({ sessionId: 'session-1' }))

    expect(useCase.received).toEqual([])
    expect(logger.rejectedPayloads).toEqual([{ eventId: 'event-1' }])
  })

  it('relies on the queue job id for idempotency instead of tracking handled events itself', async () => {
    const useCase = new FakeEnqueueSessionAnalysisUseCase()
    const handler = new OnRecordingSubmittedEnqueueAnalysis(useCase, new InMemoryAnalysisLogger())
    const event = createEvent({ sessionId: 'session-1', accountId: 'account-1' })

    await handler.handle(event)
    await handler.handle(event)

    expect(useCase.received).toEqual([
      { sessionId: 'session-1', accountId: 'account-1' },
      { sessionId: 'session-1', accountId: 'account-1' },
    ])
  })
})

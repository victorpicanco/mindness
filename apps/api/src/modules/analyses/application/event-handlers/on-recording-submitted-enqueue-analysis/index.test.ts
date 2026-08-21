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
    const handler = new OnRecordingSubmittedEnqueueAnalysis(useCase)

    await handler.handle(
      createEvent({ sessionId: 'session-1', accountId: 'account-1', durationSeconds: 90 }),
    )

    expect(useCase.received).toEqual([{ sessionId: 'session-1', accountId: 'account-1' }])
  })

  it('rejects an unexpected payload without invoking the use case', async () => {
    const useCase = new FakeEnqueueSessionAnalysisUseCase()
    const handler = new OnRecordingSubmittedEnqueueAnalysis(useCase)

    await handler.handle(createEvent({ sessionId: 'session-1' }))

    expect(useCase.received).toEqual([])
  })

  it('does not enqueue twice when the same event is delivered twice', async () => {
    const useCase = new FakeEnqueueSessionAnalysisUseCase()
    const handler = new OnRecordingSubmittedEnqueueAnalysis(useCase)
    const event = createEvent({
      sessionId: 'session-1',
      accountId: 'account-1',
      durationSeconds: 90,
    })

    await handler.handle(event)
    await handler.handle(event)

    expect(useCase.received).toEqual([{ sessionId: 'session-1', accountId: 'account-1' }])
  })
})

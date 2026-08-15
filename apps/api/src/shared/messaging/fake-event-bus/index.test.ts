import { describe, expect, it } from 'vitest'

import type { IntegrationEvent } from '@/shared/messaging/integration-event/index.js'

import { FakeEventBus } from './index.js'

function makeEvent(eventName: string): IntegrationEvent {
  return { eventId: `evt-${eventName}`, eventName, occurredAt: new Date(), version: 1, payload: {} }
}

describe('FakeEventBus', () => {
  it('accumulates published events in publish order without running handlers', async () => {
    const bus = new FakeEventBus()
    let handlerCalls = 0
    bus.subscribe('test.event', () => {
      handlerCalls += 1
      return Promise.resolve()
    })

    const first = makeEvent('first')
    const second = makeEvent('second')
    await bus.publish(first)
    await bus.publish(second)

    expect(bus.published).toEqual([first, second])
    expect(handlerCalls).toBe(0)
  })
})

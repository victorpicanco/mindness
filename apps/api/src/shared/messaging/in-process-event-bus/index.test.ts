import pino from 'pino'
import { describe, expect, it, vi } from 'vitest'

import type { IntegrationEvent } from '@/shared/messaging/integration-event/index.js'

import { InProcessEventBus } from './index.js'

function makeEvent(overrides: Partial<IntegrationEvent> = {}): IntegrationEvent {
  return {
    eventId: 'evt-1',
    eventName: 'test.event',
    occurredAt: new Date(),
    version: 1,
    payload: {},
    ...overrides,
  }
}

describe('InProcessEventBus', () => {
  it('delivers a published event to the handler subscribed to that eventName', async () => {
    const bus = new InProcessEventBus(pino({ level: 'silent' }))
    const handler = vi.fn().mockResolvedValue(undefined)
    bus.subscribe('test.event', handler)

    const event = makeEvent()
    await bus.publish(event)

    expect(handler).toHaveBeenCalledWith(event)
  })

  it('calls both handlers subscribed to the same event', async () => {
    const bus = new InProcessEventBus(pino({ level: 'silent' }))
    const first = vi.fn().mockResolvedValue(undefined)
    const second = vi.fn().mockResolvedValue(undefined)
    bus.subscribe('test.event', first)
    bus.subscribe('test.event', second)

    await bus.publish(makeEvent())

    expect(first).toHaveBeenCalledOnce()
    expect(second).toHaveBeenCalledOnce()
  })

  it('does not let a throwing handler stop the others, and logs the failure', async () => {
    const logger = pino({ level: 'silent' })
    const errorSpy = vi.spyOn(logger, 'error')
    const bus = new InProcessEventBus(logger)

    const failing = vi.fn().mockRejectedValue(new TypeError('handler exploded'))
    const succeeding = vi.fn().mockResolvedValue(undefined)
    bus.subscribe('test.event', failing)
    bus.subscribe('test.event', succeeding)

    await bus.publish(makeEvent())

    expect(succeeding).toHaveBeenCalledOnce()
    expect(errorSpy).toHaveBeenCalledOnce()
  })
})

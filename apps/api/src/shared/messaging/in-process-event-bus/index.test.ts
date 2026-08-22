import pino from 'pino'
import { describe, expect, it, vi } from 'vitest'

import { EventHandlerFailedError } from '@/shared/errors/event-handler-failed-error/index.js'
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

  it('runs every handler even when one throws, logs it, and rejects with the failure', async () => {
    const logger = pino({ level: 'silent' })
    const errorSpy = vi.spyOn(logger, 'error')
    const bus = new InProcessEventBus(logger)

    const cause = new TypeError('handler exploded')
    const failing = vi.fn().mockRejectedValue(cause)
    const succeeding = vi.fn().mockResolvedValue(undefined)
    bus.subscribe('test.event', failing)
    bus.subscribe('test.event', succeeding)

    const publishing = bus.publish(makeEvent())

    await expect(publishing).rejects.toBeInstanceOf(EventHandlerFailedError)
    expect(succeeding).toHaveBeenCalledOnce()
    expect(errorSpy).toHaveBeenCalledOnce()
  })

  it('reports the event and the number of failed handlers, keeping the first cause', async () => {
    const bus = new InProcessEventBus(pino({ level: 'silent' }))
    const cause = new TypeError('first handler exploded')
    bus.subscribe('test.event', () => Promise.reject(cause))
    bus.subscribe('test.event', () => Promise.reject(new TypeError('second handler exploded')))

    await expect(bus.publish(makeEvent({ eventId: 'evt-9' }))).rejects.toMatchObject({
      code: 'shared.EVENT_HANDLER_FAILED',
      cause,
      context: { eventName: 'test.event', eventId: 'evt-9', failedHandlers: 2 },
    })
  })

  it('resolves when the event has no subscriber', async () => {
    const bus = new InProcessEventBus(pino({ level: 'silent' }))

    await expect(bus.publish(makeEvent())).resolves.toBeUndefined()
  })
})

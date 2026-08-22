import { describe, expect, it } from 'vitest'

import { InfrastructureError } from '@/shared/errors/infrastructure-error/index.js'

import { EventHandlerFailedError } from './index.js'

describe('EventHandlerFailedError', () => {
  it('carries the diagnosis in the context and keeps the cause', () => {
    const cause = new TypeError('handler exploded')
    const error = new EventHandlerFailedError({
      context: { eventName: 'analysis_completed', eventId: 'evt-1', failedHandlers: 1 },
      cause,
    })

    expect(error).toBeInstanceOf(InfrastructureError)
    expect(error.code).toBe('shared.EVENT_HANDLER_FAILED')
    expect(error.httpStatus).toBe(500)
    expect(error.message).toBe('Event handler failed')
    expect(error.context).toEqual({
      eventName: 'analysis_completed',
      eventId: 'evt-1',
      failedHandlers: 1,
    })
    expect(error.cause).toBe(cause)
  })
})

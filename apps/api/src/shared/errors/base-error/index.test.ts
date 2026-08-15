import { describe, expect, it } from 'vitest'

import { BaseError } from './index.js'

class ConcreteError extends BaseError {
  readonly code = 'shared.CONCRETE_ERROR'
  readonly httpStatus = 500
}

class ConcreteNotFoundError extends BaseError {
  readonly code = 'shared.CONCRETE_NOT_FOUND'
  readonly httpStatus = 404
}

describe('BaseError', () => {
  it('is an instanceof BaseError through a concrete subclass', () => {
    const error = new ConcreteError('boom')

    expect(error).toBeInstanceOf(BaseError)
    expect(error).toBeInstanceOf(Error)
  })

  it('sets name to the concrete class name', () => {
    const error = new ConcreteError('boom')

    expect(error.name).toBe('ConcreteError')
  })

  it('defaults context to an empty object and preserves it when given', () => {
    const withoutContext = new ConcreteError('boom')
    expect(withoutContext.context).toEqual({})

    const withContext = new ConcreteError('boom', { context: { requestId: 'abc' } })
    expect(withContext.context).toEqual({ requestId: 'abc' })
  })

  it('preserves cause', () => {
    const cause = new TypeError('root cause')
    const error = new ConcreteError('boom', { cause })

    expect(error.cause).toBe(cause)
  })

  it('exposes httpStatus 404 on a concrete not-found subclass', () => {
    const error = new ConcreteNotFoundError('missing')

    expect(error.httpStatus).toBe(404)
  })
})

import { describe, expect, it, vi } from 'vitest'

import { DatabaseError } from '@/shared/errors/database-error/index.js'

import { registerShutdownSignals, SHUTDOWN_SIGNALS } from './index.js'

function createRecorder() {
  const handlers = new Map<NodeJS.Signals, () => void>()
  return {
    handlers,
    once: (signal: NodeJS.Signals, handler: () => void) => {
      handlers.set(signal, handler)
    },
  }
}

describe('registerShutdownSignals', () => {
  it('listens on every termination signal', () => {
    const recorder = createRecorder()

    registerShutdownSignals({
      close: () => Promise.resolve(),
      logger: { error: () => undefined, info: () => undefined },
      once: recorder.once,
      exit: () => undefined,
    })

    expect([...recorder.handlers.keys()]).toEqual([...SHUTDOWN_SIGNALS])
  })

  it('closes the process resources and exits with zero', async () => {
    const recorder = createRecorder()
    const close = vi.fn().mockResolvedValue(undefined)
    const exit = vi.fn()

    registerShutdownSignals({
      close,
      logger: { error: () => undefined, info: () => undefined },
      once: recorder.once,
      exit,
    })
    recorder.handlers.get('SIGTERM')?.()
    await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(0))

    expect(close).toHaveBeenCalledOnce()
  })

  it('closes once when a second signal arrives while closing', async () => {
    const recorder = createRecorder()
    const close = vi.fn().mockResolvedValue(undefined)
    const exit = vi.fn()

    registerShutdownSignals({
      close,
      logger: { error: () => undefined, info: () => undefined },
      once: recorder.once,
      exit,
    })
    recorder.handlers.get('SIGTERM')?.()
    recorder.handlers.get('SIGINT')?.()
    await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(0))

    expect(close).toHaveBeenCalledOnce()
  })

  it('logs and exits with one when closing fails', async () => {
    const recorder = createRecorder()
    const failure = new DatabaseError('close failed')
    const error = vi.fn()
    const exit = vi.fn()

    registerShutdownSignals({
      close: () => Promise.reject(failure),
      logger: { error, info: () => undefined },
      once: recorder.once,
      exit,
    })
    recorder.handlers.get('SIGTERM')?.()
    await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(1))

    expect(error).toHaveBeenCalledWith({ err: failure }, 'Graceful shutdown failed')
  })
})

import { describe, expect, it } from 'vitest'

import { runGuestTrialExclusively, type GuestTrialLockManager } from './index'

class SerialLockManager implements GuestTrialLockManager {
  private queue: Promise<void> = Promise.resolve()

  request<T>(_name: string, task: () => Promise<T>): Promise<T> {
    const result = this.queue.then(task)
    this.queue = result.then(
      () => undefined,
      () => undefined,
    )

    return result
  }
}

describe('runGuestTrialExclusively', () => {
  it('serializes guest identity creation attempts shared by browser tabs', async () => {
    const lockManager = new SerialLockManager()
    let concurrentTasks = 0
    let maximumConcurrency = 0
    let finishFirst: (() => void) | undefined
    const firstGate = new Promise<void>((resolve) => {
      finishFirst = resolve
    })

    const first = runGuestTrialExclusively(async () => {
      concurrentTasks += 1
      maximumConcurrency = Math.max(maximumConcurrency, concurrentTasks)
      await firstGate
      concurrentTasks -= 1

      return 'first'
    }, lockManager)
    const second = runGuestTrialExclusively(() => {
      concurrentTasks += 1
      maximumConcurrency = Math.max(maximumConcurrency, concurrentTasks)
      concurrentTasks -= 1

      return Promise.resolve('second')
    }, lockManager)

    await Promise.resolve()
    expect(maximumConcurrency).toBe(1)
    finishFirst?.()

    await expect(Promise.all([first, second])).resolves.toEqual(['first', 'second'])
    expect(maximumConcurrency).toBe(1)
  })
})

const GUEST_TRIAL_LOCK_NAME = 'mindness:guest-trial'

export interface GuestTrialLockManager {
  request<T>(name: string, task: () => Promise<T>): Promise<T>
}

function browserLockManager(): GuestTrialLockManager | undefined {
  if (typeof navigator === 'undefined') return undefined

  return navigator.locks
}

export function runGuestTrialExclusively<T>(
  task: () => Promise<T>,
  lockManager = browserLockManager(),
): Promise<T> {
  return lockManager === undefined ? task() : lockManager.request(GUEST_TRIAL_LOCK_NAME, task)
}

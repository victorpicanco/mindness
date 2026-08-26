export const TIMER_TICK_MS = 1_000

export function countdownSeconds(deadline: string, serverTimeOffsetMs = 0): number {
  const serverNow = Date.now() + serverTimeOffsetMs

  return Math.max(0, Math.ceil((new Date(deadline).getTime() - serverNow) / TIMER_TICK_MS))
}

export function formatCountdown(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const remaining = seconds % 60

  return `${String(minutes).padStart(2, '0')}:${String(remaining).padStart(2, '0')}`
}

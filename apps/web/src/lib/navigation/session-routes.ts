export const SESSIONS_ROUTE_PREFIX = '/sessions'

export function sessionPath(sessionId: string): string {
  return `${SESSIONS_ROUTE_PREFIX}/${sessionId}`
}

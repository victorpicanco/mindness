export function abandonSessionOnPageHide(sessionId: string): void {
  const path = `/api/bff/sessions/${sessionId}/abandon`

  if (navigator.sendBeacon(path)) return

  void fetch(path, { keepalive: true, method: 'POST' })
}
